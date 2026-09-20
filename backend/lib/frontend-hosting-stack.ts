import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as ec2 from "aws-cdk-lib/aws-ec2";
import * as iam from "aws-cdk-lib/aws-iam";
import * as dynamodb from "aws-cdk-lib/aws-dynamodb";
import { CfnOutput } from "aws-cdk-lib";

export interface FrontendHostingStackProps extends StackProps {
  usersTable: dynamodb.ITable;
  sessionSecret: string;
  totpEncryptionKey: string;
  awsBackendApiUrl: string;
}

/**
 * Hosts the frontend monorepo without CloudFront/Amplify - both are gated
 * behind the same new-account verification as Bedrock (see backend/README.md).
 *
 * apps/web and apps/api are served from the SAME EC2 instance/origin (Express
 * serves the built web static files, see apps/api/src/index.ts). This isn't
 * a scaling choice - it's required for session cookies to work at all without
 * HTTPS. A cookie marked Secure is dropped by the browser over plain HTTP
 * regardless of SameSite, and SameSite=None (needed for cross-origin) requires
 * Secure. Same-origin sidesteps both: SameSite=Lax, Secure=false, works over
 * HTTP. Splitting web (S3) and api (EC2) onto separate origins - the earlier
 * design - only works once there's a real HTTPS domain in front of both.
 */
export class FrontendHostingStack extends Stack {
  public readonly apiPublicIp: string;

  constructor(scope: Construct, id: string, props: FrontendHostingStackProps) {
    super(scope, id, props);

    // --- apps/api + apps/web: EC2 (t3.micro, public subnet, Elastic IP) ---
    const vpc = ec2.Vpc.fromLookup(this, "DefaultVpc", { isDefault: true });

    const securityGroup = new ec2.SecurityGroup(this, "ApiSecurityGroup", {
      vpc,
      description: "CheckOn apps/api - inbound HTTP and SSH for debugging",
      allowAllOutbound: true,
    });
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(80), "HTTP");
    securityGroup.addIngressRule(ec2.Peer.anyIpv4(), ec2.Port.tcp(22), "SSH");

    const role = new iam.Role(this, "ApiInstanceRole", {
      assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
    });
    props.usersTable.grantReadWriteData(role);

    const eip = new ec2.CfnEIP(this, "ApiEip");

    const userData = ec2.UserData.forLinux();
    userData.addCommands(
      "dnf update -y",
      "dnf install -y nodejs20 git",
      "mkdir -p /opt/checkon",
      "cd /opt/checkon && git clone --depth 1 https://github.com/Pratyakshya10/CheckOn.git .",
      "cd /opt/checkon/frontend && npm install",
      "cd /opt/checkon/frontend && npm run build -w @checkon/web",
      `cat > /opt/checkon/frontend/.env <<'ENVEOF'
NODE_ENV=production
PORT=80
CLIENT_URL=http://${eip.attrPublicIp}
AWS_BACKEND_API_URL=${props.awsBackendApiUrl}
SESSION_SECRET=${props.sessionSecret}
USERS_TABLE=${props.usersTable.tableName}
AWS_REGION=${this.region}
TOTP_ENCRYPTION_KEY=${props.totpEncryptionKey}
DEMO_LOGIN_ENABLED=true
DEMO_USER_EMAIL=demo@checkon.app
DEMO_USER_NAME=Demo Watcher
GOOGLE_OAUTH_CLIENT_ID=
GOOGLE_OAUTH_CLIENT_SECRET=
GOOGLE_OAUTH_REDIRECT_URI=http://${eip.attrPublicIp}/auth/google/callback
ENVEOF`,
      `cat > /etc/systemd/system/checkon-api.service <<'UNITEOF'
[Unit]
Description=CheckOn apps/api
After=network.target

[Service]
Type=simple
WorkingDirectory=/opt/checkon/frontend/apps/api
ExecStart=/usr/bin/npx tsx src/index.ts
Restart=always
RestartSec=5
User=root

[Install]
WantedBy=multi-user.target
UNITEOF`,
      "systemctl daemon-reload",
      "systemctl enable checkon-api",
      "systemctl start checkon-api",
    );

    const instance = new ec2.Instance(this, "ApiInstance", {
      vpc,
      vpcSubnets: { subnetType: ec2.SubnetType.PUBLIC },
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      machineImage: ec2.MachineImage.latestAmazonLinux2023(),
      securityGroup,
      role,
      userData,
    });

    new ec2.CfnEIPAssociation(this, "ApiEipAssociation", {
      allocationId: eip.attrAllocationId,
      instanceId: instance.instanceId,
    });

    this.apiPublicIp = eip.attrPublicIp;

    new CfnOutput(this, "ApiPublicIp", { value: this.apiPublicIp });
    new CfnOutput(this, "SiteUrl", { value: `http://${this.apiPublicIp}` });
  }
}
