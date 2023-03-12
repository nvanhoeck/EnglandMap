#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { InfraStack } from '../lib/infra-stack';
import { EnvironmentProps as cdkContext} from '../env/environment.properties';

const app = new cdk.App();
new InfraStack(app, `${cdkContext.appName}-${cdkContext.stage}`, {
  stackName: `${cdkContext.appName}-${cdkContext.stage}`,
  env: {
    region: cdkContext.region,
    account: cdkContext.account
  }
 });