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
    
    console.log('📞 Fetching Twilio token from:', functionUrl);

    const res = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('📡 Token endpoint response status:', res.status);

    if (!res.ok) {
      const text = await res.text();
      console.error('❌ Twilio token endpoint failed:', res.status, text);
      throw new Error(`Token endpoint failed: ${res.status} - ${text}`);
    }

    const data = await res.json();
    console.log('📦 Token endpoint response:', data);

    if (!data.token || typeof data.token !== 'string') {
      console.error('❌ Token endpoint returned no token:', data);
      throw new Error('Token endpoint returned no token');
    }

    return data.token;
  }

  async initialize() {
    try {
      console.log('=== Initializing Twilio Voice ===');
      console.log('Identity:', this.identity);

      // Fetch Twilio access token from edge function
      const token = await this.fetchTwilioToken();
      console.log('✅ Got Twilio token (first 40 chars):', token.slice(0, 40), '...');

      // Initialize Twilio Device
      console.log('🔧 Initializing Twilio Device with token...');
      this.device = new Device(token, {
        logLevel: 1,
        codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
      });

      // Set up event listeners
      this.device.on('registered', () => {
        console.log('Twilio Device registered');
        this.onCallStatusChange?.('ready');
      });

      this.device.on('error', (error) => {
        console.error('=== Twilio Device Error ===');
        console.error('Error object:', error);
        console.error('Error code:', error?.code);
        console.error('Error message:', error?.message);
        console.error('Error name:', error?.name);
        console.error('Full error:', JSON.stringify(error, null, 2));
        this.onCallStatusChange?.('error');
      });

      this.device.on('incoming', (call) => {
        console.log('Incoming call from:', call.parameters.From);
        this.currentCall = call;
        this.setupCallHandlers(call);
        this.onCallStatusChange?.('incoming', call);
      });

      // Register the device
      await this.device.register();
      console.log('Twilio Device initialized successfully');

      return true;
    } catch (error) {
      console.error('=== Error Initializing Twilio Voice ===');
      console.error('Error type:', error?.constructor?.name);
      console.error('Error message:', error instanceof Error ? error.message : String(error));
      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack');
      console.error('Full error object:', error);
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
