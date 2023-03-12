import { RemovalPolicy } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb'
import { IGrantable } from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

interface IndexAtt{
  partitionKey: string; 
  sortKey: string;
}
interface DatabaseStackProps {
    id: string,
    scope: Construct,
    tableName: string,
    partitionCode: string //'uniekeCode'
    sortKey?: string // 'email'
    indexKeys?: IndexAtt[] //aankomstEpoch
}

export class DatabaseStack extends Construct{

    private readonly table:dynamodb.Table;

    public constructor(props: DatabaseStackProps) {
        super(props.scope, props.id)
        this.table = new dynamodb.Table(this, 'Table', {
            tableName: props.tableName,
            removalPolicy: RemovalPolicy.RETAIN,
            stream: dynamodb.StreamViewType.NEW_IMAGE,
            tableClass: dynamodb.TableClass.STANDARD,
            partitionKey: { name: props.partitionCode, type: dynamodb.AttributeType.STRING },
            billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
            sortKey: !!props.sortKey ? {name: props.sortKey, type: dynamodb.AttributeType.STRING} : undefined,
          });
          
          // this.table.autoScaleWriteCapacity({
          //   minCapacity: 1,
          //   maxCapacity: 10,
          // }).scaleOnUtilization({ targetUtilizationPercent: 75 });

          // this.table.autoScaleReadCapacity({
          //   minCapacity: 1,
          //   maxCapacity: 10,
          // }).scaleOnUtilization({ targetUtilizationPercent: 75 });

          if(props.indexKeys) {
            props.indexKeys.forEach((indexKey: IndexAtt) => {
              this.table.addGlobalSecondaryIndex({
                indexName: indexKey.partitionKey,
                partitionKey: {
                  name: indexKey.partitionKey,
                  type: dynamodb.AttributeType.STRING,
                },
                sortKey: {
                  name: indexKey.sortKey,
                  type: dynamodb.AttributeType.STRING,
                }
          })
            })
      }
    }

    public grantReadWriteTo(grantee: IGrantable): void {
        this.table.grantReadWriteData(grantee)
    }

    public getTable(): dynamodb.Table {
        return this.table;
    }
}