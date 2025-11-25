import { Device, Call } from '@twilio/voice-sdk';

export class TwilioVoiceManager {
  private device: Device | null = null;
  private currentCall: Call | null = null;
  private identity: string;
  private onCallStatusChange?: (status: string, call?: Call) => void;

  constructor(identity: string, onCallStatusChange?: (status: string, call?: Call) => void) {
    this.identity = identity;
    this.onCallStatusChange = onCallStatusChange;
  }

  private async fetchTwilioToken(): Promise<string> {
    const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twilio-voice-token`;
    
    console.log('[Twilio] Fetching token from:', functionUrl);

    const res = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('[Twilio] Token response status:', res.status);

    const text = await res.text();
    console.log('[Twilio] Raw token endpoint response text:', text);

    if (!res.ok) {
      const errorMsg = `Token endpoint failed: ${res.status} ${text}`;
      console.error('[Twilio] ❌ Token fetch failed:', errorMsg);
      throw new Error(errorMsg);
    }

    let data: any;
    try {
      data = JSON.parse(text);
    } catch (err) {
      console.error('[Twilio] ❌ Could not parse JSON from token endpoint:', err);
      throw new Error(`Could not parse token response: ${err}`);
    }

    console.log('[Twilio] Parsed token endpoint JSON:', data);

    if (!data.token || typeof data.token !== 'string') {
      console.error('[Twilio] ❌ Token endpoint returned no token string:', data);
      throw new Error('Token endpoint returned no token string');
    }

    console.log('[Twilio] ✅ Token received (length:', data.token.length, ')');
    console.log('[Twilio] Token (first 50 chars):', data.token.slice(0, 50), '...');

    return data.token;
  }

  async initialize() {
    try {
      console.log('[Twilio] === Initializing Twilio Voice ===');
      console.log('[Twilio] Identity:', this.identity);

      // Fetch Twilio access token from edge function
      const token = await this.fetchTwilioToken();
      console.log('[Twilio] ✅ Got token, type:', typeof token);
      console.log('[Twilio] Token is string?', typeof token === 'string');
      console.log('[Twilio] Token length:', token.length);
      console.log('[Twilio] Token (first 50 chars):', token.slice(0, 50), '...');

      // Verify it's a proper JWT format (should have 3 parts separated by dots)
      const parts = token.split('.');
      console.log('[Twilio] Token has', parts.length, 'parts (should be 3 for JWT)');

      // Initialize Twilio Device
      console.log('[Twilio] 🔧 Creating Twilio Device...');
      this.device = new Device(token, {
        logLevel: 1,
        codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
      });

      console.log('[Twilio] ✅ Device object created:', this.device);

      // Set up event listeners
      this.device.on('registered', () => {
        console.log('[Twilio] ✅ Device registered successfully');
        this.onCallStatusChange?.('ready');
      });

      this.device.on('error', (error) => {
        console.error('[Twilio] ❌ === Device Error ===');
        console.error('[Twilio] Error code:', error?.code);
        console.error('[Twilio] Error message:', error?.message);
        console.error('[Twilio] Error name:', error?.name);
        console.error('[Twilio] Full error object:', error);
        console.error('[Twilio] Error details:', JSON.stringify(error, null, 2));
        
        // Show user-friendly error alert
        const errorMsg = `Twilio error: ${error?.code || 'Unknown'} - ${error?.message || 'No message'}`;
        alert(errorMsg);
        
        this.onCallStatusChange?.('error');
      });

      this.device.on('incoming', (call) => {
        console.log('Incoming call from:', call.parameters.From);
        this.currentCall = call;
        this.setupCallHandlers(call);
        this.onCallStatusChange?.('incoming', call);
      });

      // Register the device
      console.log('[Twilio] 🔧 Registering device...');
      await this.device.register();
      console.log('[Twilio] ✅ Device registered and initialized successfully');

      return true;
    } catch (error) {
      console.error('[Twilio] ❌ === Error Initializing Twilio Voice ===');
      console.error('[Twilio] Error type:', error?.constructor?.name);
      console.error('[Twilio] Error message:', error instanceof Error ? error.message : String(error));
      console.error('[Twilio] Error stack:', error instanceof Error ? error.stack : 'No stack');
      console.error('[Twilio] Full error object:', error);
      
      // Show user-friendly error
      const errorMsg = error instanceof Error ? error.message : String(error);
      alert(`Kunne ikke initialisere telefon: ${errorMsg}`);
      
      throw error;
    }
  }

  private setupCallHandlers(call: Call) {
    call.on('accept', () => {
      console.log('Call accepted');
      this.onCallStatusChange?.('active', call);
    });

    call.on('disconnect', () => {
      console.log('Call disconnected');
      this.currentCall = null;
      this.onCallStatusChange?.('disconnected');
    });

    call.on('reject', () => {
      console.log('Call rejected');
      this.currentCall = null;
      this.onCallStatusChange?.('rejected');
    });

    call.on('cancel', () => {
      console.log('Call cancelled');
      this.currentCall = null;
      this.onCallStatusChange?.('cancelled');
    });
  }

  async makeCall(phoneNumber: string) {
    if (!this.device) {
      throw new Error('Device not initialized');
    }

    try {
      console.log('Making call to:', phoneNumber);
      
      const call = await this.device.connect({
        params: {
          To: phoneNumber
        }
      });

      this.currentCall = call;
      this.setupCallHandlers(call);
      this.onCallStatusChange?.('connecting', call);

      return call;
    } catch (error) {
      console.error('Error making call:', error);
      throw error;
    }
  }

  acceptIncomingCall() {
    if (this.currentCall) {
      this.currentCall.accept();
    }
  }

  rejectIncomingCall() {
    if (this.currentCall) {
      this.currentCall.reject();
    }
  }

  hangup() {
    if (this.currentCall) {
      this.currentCall.disconnect();
    }
  }

  mute() {
    if (this.currentCall) {
      this.currentCall.mute(true);
    }
  }

  unmute() {
    if (this.currentCall) {
      this.currentCall.mute(false);
    }
  }

  isMuted(): boolean {
    return this.currentCall?.isMuted() || false;
  }

  destroy() {
    if (this.currentCall) {
      this.currentCall.disconnect();
    }
    if (this.device) {
      this.device.unregister();
      this.device.destroy();
    }
  }

  getCurrentCall(): Call | null {
    return this.currentCall;
  }
}
