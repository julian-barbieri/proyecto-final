import axios from 'axios';

interface GoogleTokenResponse {
  email: string;
  name: string;
  picture: string;
  hd?: string;
  iss: string;
  aud: string;
  exp: number;
  iat: number;
  sub: string;
}

export async function verifyGoogleToken(
  idToken: string,
  expectedAudience: string
): Promise<GoogleTokenResponse> {
  try {
    // In production, we should verify the token with Google's API
    // For now, we'll decode the JWT and validate basic fields
    // In production, you would use google-auth-library
    
    const response = await axios.get(
      `https://www.googleapis.com/oauth2/v3/tokeninfo?id_token=${idToken}`
    );

    const decoded = response.data;

    // Validate audience
    if (decoded.aud !== expectedAudience) {
      throw new Error('Invalid token audience');
    }

    // Validate issuer
    if (decoded.iss !== 'https://accounts.google.com' && 
        decoded.iss !== 'accounts.google.com') {
      throw new Error('Invalid token issuer');
    }

    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (decoded.exp < now) {
      throw new Error('Token has expired');
    }

    return {
      email: decoded.email,
      name: decoded.name,
      picture: decoded.picture,
      hd: decoded.hd,
      iss: decoded.iss,
      aud: decoded.aud,
      exp: decoded.exp,
      iat: decoded.iat,
      sub: decoded.sub,
    };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Google token validation failed: ${error.message}`);
    }
    throw new Error('Google token validation failed');
  }
}

