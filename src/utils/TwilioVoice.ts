import { Device, Call } from '@twilio/voice-sdk';
import { supabase } from '@/integrations/supabase/client';

export class TwilioVoiceManager {
  private device: Device | null = null;
  private currentCall: Call | null = null;
  private identity: string;
  private onCallStatusChange?: (status: string, call?: Call) => void;

  constructor(identity: string, onCallStatusChange?: (status: string, call?: Call) => void) {
    this.identity = identity;
    this.onCallStatusChange = onCallStatusChange;
  }

  async initialize() {
    try {
      console.log('=== Initializing Twilio Voice ===');
      console.log('Identity:', this.identity);

      // Get access token from edge function
      console.log('Requesting access token from edge function...');
      const { data, error } = await supabase.functions.invoke('twilio-voice-token', {
        body: { identity: this.identity }
      });

      console.log('Token endpoint response:', { data, error });

      if (error) {
        console.error('Error from token endpoint:', error);
        throw new Error(`Token endpoint error: ${JSON.stringify(error)}`);
      }
      
      if (!data?.token) {
        console.error('No token in response. Full response:', data);
        throw new Error(`No token received. Response: ${JSON.stringify(data)}`);
      }

      console.log('Access token received, length:', data.token.length);
      console.log('Token first 50 chars:', data.token.substring(0, 50));

      // Initialize device
      this.device = new Device(data.token, {
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
