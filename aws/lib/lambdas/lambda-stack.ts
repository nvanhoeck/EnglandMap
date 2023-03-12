import { Duration, Stack } from 'aws-cdk-lib';
import * as lambdaNodeJs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as path from 'path';
import * as apiGateway from 'aws-cdk-lib/aws-apigateway';
import { DatabaseStack } from '../database/database-stack';
import { aws_events, aws_events_targets } from 'aws-cdk-lib';
import { Table } from 'aws-cdk-lib/aws-dynamodb';
import { DynamoEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';

export class CdkLambdaStack {
    private lambdas: lambdaNodeJs.NodejsFunction[] = [];
    private lambdaGatewayResource: apiGateway.Resource;
    private lambdaProps: LambdaProps;
    private httpMethods: HttpMethodType[] = [];
    private eventTriggerFor: HttpMethodType[] = [];
    private eventSourcesFor: EventSourceProps[] = []

    constructor(lambdaProps: LambdaProps) {
        this.lambdaProps = {...lambdaProps, databases: lambdaProps.databases || [], };
    }

    public addMethod(methodType: HttpMethodType) {
        this.httpMethods.push(methodType)
        return this;
    }

    public addEventTriggerFor(methodType: HttpMethodType) {
        this.eventTriggerFor.push(methodType)
        return this;
    }

    public addEventSourceFor(eventSourceConfig: EventSourceProps) {
        this.eventSourcesFor.push(eventSourceConfig);
        return this;
    }

    public build() {
        if (!this.httpMethods || this.httpMethods.length === 0) {
            throw new Error("You should have at least one endpoint");
        } else {
            this.lambdaGatewayResource = this.lambdaProps.apiGateway.root.addResource(this.lambdaProps.functionName);
            if (!!this.lambdaProps.subPath) {
                this.lambdaGatewayResource = this.lambdaGatewayResource.addResource(this.lambdaProps.subPath);
            };
            [...new Set(this.httpMethods)].forEach((httpMethod) => {
                this.buildLambda(httpMethod);
            });
        }
        return this.lambdas;
    }

    private buildLambda(httpMethod: HttpMethodType) {
        const buildlambda = new lambdaNodeJs.NodejsFunction(this.lambdaProps.scope, `${this.lambdaProps.functionName}_${httpMethod.toLowerCase()}`, {
            functionName: `${this.lambdaProps.functionName}_${httpMethod.toLowerCase()}`,
            handler: "handler",
            runtime: lambda.Runtime.NODEJS_16_X,
            entry: path.join(__dirname, `../../../src/lambdas/${this.lambdaProps.functionName}/${httpMethod.toLowerCase()}/index.ts`),
            memorySize: 512,
            timeout: Duration.seconds(10),
            environment: {
                //BUCKET: this.lambdaProps.bucketName,
                //RDS_SECRET_NAME: this.lambdaProps.secretName,
            },
            initialPolicy: [...this.lambdaProps.lambdaPolicies],
            role: this.lambdaProps.lambdaRole,
        });
        this.lambdas.push(buildlambda)
        this.lambdaGatewayResource.addMethod(httpMethod, new apiGateway.LambdaIntegration(buildlambda))
        this.lambdas.forEach(lambda => {
            this.lambdaProps.databases.forEach(dynamoDb => dynamoDb.grantReadWriteTo(lambda))
        })

        this.eventTriggerFor.forEach(element => {
            if(element === httpMethod) {
                new aws_events.Rule(this.lambdaProps.scope, "Natuurhuisje-Import", {
                    description: "Import every 30 minutes natuurhuisjes calender and update ours",
                    targets: [
                        new aws_events_targets.LambdaFunction(buildlambda),
                    ],
                    schedule: aws_events.Schedule.rate(Duration.minutes(30)),
                })
            }
        });

        this.eventSourcesFor.forEach(element => {
            if(element.methodType === httpMethod) {
                buildlambda.addEventSource(new DynamoEventSource(element.table, {
                    startingPosition: lambda.StartingPosition.TRIM_HORIZON,
                    batchSize: 5,
                    bisectBatchOnError: true,
                    //onFailure: new SqsDlq(deadLetterQueue),
                    retryAttempts: 10,
                  }));
            }
        });
    }
}

export type LambdaProps = {
    functionName: string;
    //secretName: string;
    lambdaPolicies: any[];
    lambdaRole: any;
    apiGateway: apiGateway.RestApi;
    //resourceChildrenPath?: ResourcePath;
    scope: Stack;
    subPath?: string,
    databases: DatabaseStack[]
}

type HttpMethodType = 'POST' | 'PUT' | 'PATCH' | 'GET' | 'DELETE';
type ResourcePath = {
    //TODO prob fix
    resourceChildrenPath: ResourcePath;
    httpMethods: HttpMethodType[];
}

type EventSourceProps = {
    methodType: HttpMethodType
    table: Table
}