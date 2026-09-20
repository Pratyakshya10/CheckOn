import { Stack, StackProps, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
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
 * apps/web is a static S3 website (same pattern as PublicSiteStack); apps/api
 * needs a real always-on Node process, so it runs on a small EC2 instance.
 *
 * Two-pass deploy: the S3 website URL is deterministic (bucket naming), so
 * apps/api's CLIENT_URL can be baked into its user-data in this same deploy.
 * The reverse isn't true - apps/web's build needs to know apps/api's public
 * IP, and that IP doesn't exist until this stack deploys and allocates the
 * Elastic IP. So: deploy this stack first, then build apps/web with
 * VITE_API_URL=http://<the EIP output> and sync it to webBucket separately
 * (see backend/README.md's deploy steps) - not something CDK can sequence
 * in one shot without a custom resource, which isn't worth it here.
 */
export class FrontendHostingStack extends Stack {
  public readonly webBucket: s3.Bucket;
  public readonly webSiteUrl: string;
  public readonly apiPublicIp: string;

  constructor(scope: Construct, id: string, props: FrontendHostingStackProps) {
    super(scope, id, props);

    // --- apps/web: static S3 website --------------------------------------
    this.webBucket = new s3.Bucket(this, "WebBucket", {
      bucketName: `checkon-web-${this.account}-${this.region}`,
      websiteIndexDocument: "index.html",
      websiteErrorDocument: "index.html", // SPA fallback - client-side routing, if any, still resolves
      publicReadAccess: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });
    this.webSiteUrl = this.webBucket.bucketWebsiteUrl;

    // --- apps/api: EC2 (t3.micro, public subnet, Elastic IP) --------------
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
      `cat > /opt/checkon/frontend/.env <<'ENVEOF'
NODE_ENV=production
PORT=80
CLIENT_URL=${this.webSiteUrl}
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

    new CfnOutput(this, "WebSiteUrl", { value: this.webSiteUrl });
    new CfnOutput(this, "ApiPublicIp", { value: this.apiPublicIp });
    new CfnOutput(this, "ApiUrl", { value: `http://${this.apiPublicIp}` });
  }
}
