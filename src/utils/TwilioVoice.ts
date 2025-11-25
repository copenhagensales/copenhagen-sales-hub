import { Device, Call } from '@twilio/voice-sdk';

export class TwilioVoiceManager {
  private device: Device | null = null;
  private currentCall: Call | null = null;
  private identity: string;
  private onCallStatusChange?: (status: string, call?: Call) => void;
  private onDebugUpdate?: (info: { 
    tokenLength?: number; 
    deviceError?: string;
    [key: string]: any 
  }) => void;

  constructor(
    identity: string, 
    onCallStatusChange?: (status: string, call?: Call) => void,
    onDebugUpdate?: (info: { 
      tokenLength?: number; 
      deviceError?: string;
      [key: string]: any 
    }) => void
  ) {
    // Always use "agent" as identity for incoming calls to work
    this.identity = "agent";
    this.onCallStatusChange = onCallStatusChange;
    this.onDebugUpdate = onDebugUpdate;
  }

  private async fetchTwilioToken(): Promise<string> {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const url = `${supabaseUrl}/functions/v1/twilio-token`;
    
    console.log('[Twilio] Fetching token from:', url);
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('[Twilio] Token response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Twilio] Token fetch failed:', errorText);
      throw new Error(`Failed to fetch token: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    console.log('[Twilio] Token response:', { 
      hasToken: !!data.token,
      tokenLength: data.token?.length 
    });

    if (!data.token || typeof data.token !== 'string') {
      throw new Error('No valid token in response');
    }

    console.log('[Twilio] Token received, length:', data.token.length);
    console.log('[Twilio] Token preview:', data.token.slice(0, 50) + '...');

    this.onDebugUpdate?.({ tokenLength: data.token.length });

    return data.token;
  }

  async initialize() {
    try {
      console.log('[Twilio] === Initializing Twilio Voice ===');
      console.log('[Twilio] Identity: agent (hardcoded for incoming calls)');

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
      
      try {
        this.device = new Device(token, {
          logLevel: 1,
          codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
        });
        
        console.log('[Twilio] ✅ Device object created:', this.device);
      } catch (deviceError) {
        console.error('[Twilio] ❌ Device.create failed:', deviceError);
        const errorMsg = deviceError instanceof Error ? deviceError.message : String(deviceError);
        
        // Update debug info
        this.onDebugUpdate?.({ 
          deviceError: `Device creation failed: ${errorMsg}`
        });
        
        throw new Error(`Failed to create Twilio Device: ${errorMsg}`);
      }

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
        console.error('[Twilio] Error description:', error?.description);
        console.error('[Twilio] Error explanation:', error?.explanation);
        console.error('[Twilio] Full error object:', error);
        console.error('[Twilio] Error details:', JSON.stringify(error, null, 2));
        
        // Build detailed error message
        let errorDetails = '';
        
        // Check for specific error codes
        if (error?.code === 20101) {
          console.error('[Twilio] ❌ AccessTokenInvalid - Token was rejected by Twilio');
          errorDetails = 'AccessTokenInvalid: JWT signature or structure is invalid. Check that credentials are from same Twilio account.';
        } else if (error?.code === 31204) {
          console.error('[Twilio] ❌ JWT is invalid - Structure or format error');
          errorDetails = 'JWT invalid: Token structure or format error';
        } else {
          errorDetails = error?.explanation || error?.description || 'Unknown Twilio error';
        }
        
        const errorMsg = `Twilio error ${error?.code || 'Unknown'}: ${error?.message || 'No message'}`;
        const fullErrorMsg = `${errorMsg}\n${errorDetails}`;
        
        // Update debug info
        this.onDebugUpdate?.({ 
          deviceError: fullErrorMsg
        });
        
        // Show user-friendly error alert
        alert(fullErrorMsg);
        
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
