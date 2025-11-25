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
      console.log('Initializing Twilio Voice with identity:', this.identity);

      // Get access token from edge function
      const { data, error } = await supabase.functions.invoke('twilio-voice-token', {
        body: { identity: this.identity }
      });

      if (error) throw error;
      if (!data?.token) throw new Error('No token received');

      console.log('Access token received');

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
        console.error('Twilio Device error:', error);
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
      console.error('Error initializing Twilio Voice:', error);
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
