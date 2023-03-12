import { LambdaWrapper } from "../../lambda-wrapper"
import { APIGatewayEvent, APIGatewayEventRequestContext, APIGatewayProxyResult } from "aws-lambda"
import * as AWS from 'aws-sdk'
const dynamo = new AWS.DynamoDB.DocumentClient();
export const handler = async (event: APIGatewayEvent, context: APIGatewayEventRequestContext): Promise<APIGatewayProxyResult> => {
    return LambdaWrapper(handleEvent, event, context)
}

const handleEvent = async (event: APIGatewayEvent, context: APIGatewayEventRequestContext, additionalContext?: any): Promise<any> => {
    let body;
    let statusCode = '200';

    try {
            body = await dynamo.put(JSON.parse(event.body)).promise();
        } catch (err) {
        statusCode = '400';
        body = err.message;
    } finally {
        body = JSON.stringify(body);
    }

    return {
        statusCode,
        body,
    };
}