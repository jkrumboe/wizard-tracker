// Webhook integration service for additional functionality
// This complements the existing real-time subscriptions

class WebhookIntegration {
  constructor() {
    this.webhookEndpoint = 'https://appwrite.jkrumboe.dev/online';
  }

  // Create HMAC signature for webhook testing
  async createSignature(payload) {
    try {
      // Get the signature key from environment variables
      let key = import.meta.env.VITE_APPWRITE_WEBHOOK_SIGNATURE_KEY;
      
      if (!key) {
        throw new Error('Webhook signature key not configured in environment');
      }
      
      // Remove quotes if they exist
      key = key.replace(/^"(.*)"$/, '$1');
      
      const encoder = new TextEncoder();
      const keyData = encoder.encode(key);
      const payloadData = encoder.encode(payload);
      
      const cryptoKey = await crypto.subtle.importKey(
        'raw',
        keyData,
        { name: 'HMAC', hash: 'SHA-1' },
        false,
        ['sign']
      );
      
      const signature = await crypto.subtle.sign('HMAC', cryptoKey, payloadData);
      return Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    } catch (error) {
      console.error('Error creating signature:', error);
      throw error;
    }
  }

  // Test webhook connectivity with proper signature
  async testWebhook() {
    try {
      // Create a test payload similar to what Appwrite would send
      const testPayload = JSON.stringify({
        events: ["databases.688cfb4b002d001bc2e5.collections.688cfb57002021464526.documents.*.update"],
        data: {
          $id: "test-document-id",
          status: true,
          $createdAt: new Date().toISOString(),
          $updatedAt: new Date().toISOString()
        },
        timestamp: Date.now(),
        test: true
      });
      
      // Create signature for the payload
      const signature = await this.createSignature(testPayload);
      
      const response = await fetch(this.webhookEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Appwrite-Webhook-Signature': signature,
          'User-Agent': 'Appwrite-Server',
          'X-Test-Webhook': 'true'
        },
        body: testPayload
      });
      
      const responseText = await response.text();
      
      return {
        success: response.ok,
        status: response.status,
        statusText: response.statusText,
        response: responseText,
        signature: signature
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Simple connectivity test without signature
  async testConnectivity() {
    try {
      const response = await fetch(this.webhookEndpoint, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      return {
        success: response.ok,
        status: response.status,
        statusText: response.statusText
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }
}

export default new WebhookIntegration();
