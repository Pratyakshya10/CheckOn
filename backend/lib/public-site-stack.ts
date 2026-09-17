import { Stack, StackProps, Duration, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";

/**
 * Serves /w/<slug> pages
 */
export class PublicSiteStack extends Stack {
  public readonly bucket: s3.Bucket;
  public readonly distribution: cloudfront.Distribution;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.bucket = new s3.Bucket(this, "PublicSiteBucket", {
      bucketName: `checkon-public-site-${this.account}-${this.region}`,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    const oac = new cloudfront.S3OriginAccessControl(this, "PublicSiteOAC");

    this.distribution = new cloudfront.Distribution(this, "PublicSiteDistribution", {
      comment: "checkon public watch pages",
      defaultRootObject: "index.html",
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(this.bucket, {
          originAccessControl: oac,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        cachePolicy: new cloudfront.CachePolicy(this, "PublicSiteCachePolicy", {
          defaultTtl: Duration.minutes(5),
          minTtl: Duration.seconds(0),
          maxTtl: Duration.hours(1),
        }),
        compress: true,
      },
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });
  }
}
