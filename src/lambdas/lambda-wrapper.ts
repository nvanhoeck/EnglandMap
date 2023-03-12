import { APIGatewayEvent, APIGatewayEventRequestContext, APIGatewayProxyResult } from "aws-lambda"
import * as AWS from 'aws-sdk';

export const LambdaWrapper = async (functionExecution: (event: APIGatewayEvent | any | any[], context: APIGatewayEventRequestContext | any) => any, event: APIGatewayEvent | any | any[], context: APIGatewayEventRequestContext): Promise<APIGatewayProxyResult | any> => {
    let sqlConnection;
    try {
        AWS.config.update({ region: 'eu-west-1' });
        //sqlConnection = await handleSqlAccess()
        //const addctx = { mySqlConnection: sqlConnection };
        const response = await functionExecution(event, context);
        //sqlConnection.destroy();
        return {
            statusCode: 200, body: JSON.stringify(response), headers: {
                "Access-Control-Allow-Headers": "Content-Type",
                //TODO fix
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "OPTIONS,POST,GET,PUT,DELETE,PATCH"
            }
        };
    } catch (error: any) {
        //if(!!sqlConnection) sqlConnection.destroy();
        console.error("ERORR", error);
        return {
            statusCode: 500, body: JSON.stringify((error as Error).message), headers: {
                "Access-Control-Allow-Headers": "Content-Type",
                //TODO fix
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "OPTIONS,POST,GET,PUT,DELETE,PATCH"
            }
        };
    }
}

