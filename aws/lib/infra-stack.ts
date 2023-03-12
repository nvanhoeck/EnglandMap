import { Stack, StackProps, Duration, RemovalPolicy } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { EnvironmentProps as context } from '../env/environment.properties';

import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as apiGateway from 'aws-cdk-lib/aws-apigateway';
import * as ssm from 'aws-cdk-lib/aws-secretsmanager';
import { CdkLambdaStack } from './lambdas/lambda-stack';
import { englandLocations} from './lambdas/lambda-definitions';
import { DatabaseStack } from './database/database-stack';
import { HttpMethod } from 'aws-cdk-lib/aws-events';
import { Effect, PolicyStatement } from 'aws-cdk-lib/aws-iam';
import { LifecyclePolicy } from 'aws-cdk-lib/aws-efs';
import { BlockPublicAccess } from 'aws-cdk-lib/aws-s3';

// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class InfraStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const vpc = new ec2.Vpc(this, 'Vpc', {
      maxAzs: 2, // Default is all AZs in the region
    });

    const lambdaRole = new iam.Role(this, 'lambdaRole', {
      roleName: `${context.appName}-lambda-role-${context.stage}`,
      description: `Lambda role for ${context.appName}`,
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName('ReadOnlyAccess'),
      iam.ManagedPolicy.fromManagedPolicyArn(
        this,
        'lambdaVPCAccessPolicy',
        'arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole'
      ),],
    });

    // Attach inline policies to Lambda role
    lambdaRole.attachInlinePolicy(
      new iam.Policy(this, 'lambdaExecutionAccess', {
        policyName: 'lambdaExecutionAccess',
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            resources: ['*'],
            actions: [
              'logs:CreateLogGroup',
              'logs:CreateLogStream',
              'logs:DescribeLogGroups',
              'logs:DescribeLogStreams',
              'logs:PutLogEvents',
            ],
          }),
        ],
      })
    );

    lambdaRole.attachInlinePolicy(
      new iam.Policy(this, 'lambdaDatabaseAccess', {
        policyName: 'lambdaDatabaseAccess',
        statements: [
          new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            resources: ['*'],
            actions: [
              'dynamodb:*',
            ],
          }),
        ],
      })
    );

    const bucket = new s3.Bucket(this, "EnglandLocationStackBucket", {
      bucketName: 'england-locations-stack-bucket',
      autoDeleteObjects: false,
      blockPublicAccess: BlockPublicAccess.BLOCK_ALL,
      removalPolicy: RemovalPolicy.DESTROY
    })



    const restApi = new apiGateway.RestApi(this, this.stackName + "RestApi", {
      defaultCorsPreflightOptions: {
        allowHeaders: [
          'Content-Type',
          'X-Amz-Date',
          'Authorization',
          'X-Api-Key',
        ],
        allowMethods: ['OPTIONS', 'GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        //TODO change naar onze ip-adressen
        allowOrigins: ['*'],
      },
      deployOptions: {
        stageName: context.stage,
        metricsEnabled: true,
        loggingLevel: apiGateway.MethodLoggingLevel.INFO,
        dataTraceEnabled: true,
      },
    })

    const lambdaStackPolicy = new iam.PolicyStatement()
    lambdaStackPolicy.addActions("s3:ListBucket")
    lambdaStackPolicy.addResources(bucket.bucketArn)

    //Generate the username and password, then store in secrets manager
    //TODO delete? 
    //const databaseCredentialsSecret = ssm.Secret.fromSecretCompleteArn(this, `${context.stage}/${context.appName}/mySql`, `arn:aws:secretsmanager:${context.region}:${context.account}:secret:${context.stage}/${context.appName}/mySql-${secretContext.ssmSuffix}`);


    //Lambda's:
    //Verify UserCode (+ get userData???)
    // --The user send his unique code from a previous order, to autofill his userData

    //Update Booking Status
    // --Keeps track of the booking statusses: IN_VERWERKING | (ONTVANGEN/)BEVESTIGD | FOUTIEF | GEANULLEERD_DOOR_BOEKER | GEANNULEERD_DOOR_VERHUURDER
    // --IN_VERWERKING is after a user books his order and verification is ok, immediatly this status with his unique code is sent
    // --BEVESTIGD is if Koen accepts
    // --FOUTIEF is if something went wrong during processing
    // --GEANNULEERD_DOOR_BOEKER is if the booking is cancelled
    // --GEANNULEERD_DOOR_VERHUURDER is if Koen cancels the order

    //Verify And Send Order
    //--Verify all fields, if not, send error messages
    //--If verification Ok, verify is user already exists, if so, overwrite data
    //--If verification is ok, send status update
    //--Save data to the database

    //Delete order

    //Fetch gites prices

    //Cron Job (daily)
    //--Checks if all statusses are in an OK state (!= FOUTIEF) and their orderMoment (epoch) is longer as 10 minutes ago.

    const locationsDB = new DatabaseStack({id: 'EnglandLocations', scope: this, tableName: 'EnglandLocations', partitionCode: 'id', sortKey: 'TijdstipEpoch', indexKeys: []})

    new CdkLambdaStack({
      functionName: englandLocations,
      //secretName: `${context.stage}/${context.appName}/mySql`,
      lambdaPolicies: [lambdaStackPolicy],
      lambdaRole: lambdaRole,
      apiGateway: restApi,
      scope: this,
      databases: [locationsDB]
    })
    .addMethod("GET")
    .addMethod("POST")
    .build()

    //databaseCredentialsSecret.grantRead(lambdaRole);
  }
}
