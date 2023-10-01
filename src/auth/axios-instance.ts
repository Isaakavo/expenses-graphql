import axios from 'axios';

export type AuthenticationResult = {
  AccessToken: string;
  ExpiresIn: string;
  IdToken: string;
  RefreshToken: string;
  TokenType: string;
};

export type CognitoRespose = {
  AuthenticationResult: AuthenticationResult,
  challengeParameters: object
}

export const instance = axios.create({
  baseURL: 'https://cognito-idp.us-east-2.amazonaws.com',
  timeout: 2000,
  headers: {
    'X-Amz-Target': 'AWSCognitoIdentityProviderService.InitiateAuth',
    'Content-Type': 'application/x-amz-json-1.1',
  },
});
