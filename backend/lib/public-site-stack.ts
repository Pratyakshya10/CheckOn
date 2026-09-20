import { Stack, StackProps, RemovalPolicy } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";

/**
 * Serves /w/<slug> pages via S3 static website hosting, direct - no
 * CloudFront in front of it right now.
 *
 * This was originally CloudFront + an Origin Access Control-gated private
 * bucket (see git history). New AWS accounts can be blocked from creating
 * CloudFront distributions at all ("your account must be verified") until
 * AWS support manually clears them - which can take hours to days, and
 * isn't worth blocking the whole deploy on. Serving straight from a public
 * S3 bucket costs nothing here: this content is meant to be public anyway
 * (no access-control loss, unlike gating something private), so there's no
 * security tradeoff - only a caching/CDN one. Swap back to CloudFront once
 * the account is verified; nothing about the bucket or the page-regeneration
 * logic needs to change to do that.
 */
export class PublicSiteStack extends Stack {
  public readonly bucket: s3.Bucket;
  public readonly siteUrl: string;

  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    this.bucket = new s3.Bucket(this, "PublicSiteBucket", {
      bucketName: `checkon-public-site-${this.account}-${this.region}`,
      websiteIndexDocument: "index.html",
      publicReadAccess: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    this.siteUrl = this.bucket.bucketWebsiteUrl;
  }
}
