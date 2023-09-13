import { JwksClient } from 'jwks-rsa'

export const jwksClientInstance = new JwksClient({
  jwksUri:
    'https://cognito-idp.us-east-2.amazonaws.com/us-east-2_R894BlMpq/.well-known/jwks.json',
});