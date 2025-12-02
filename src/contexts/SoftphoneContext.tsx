import React, { createContext, useContext, useState, useCallback } from "react";
import { useTwilioManager } from "@/hooks/useTwilioManager";

interface SoftphoneContextType {
  isOpen: boolean;
  openSoftphone: (phoneNumber?: string) => void;
  closeSoftphone: () => void;
  initialPhoneNumber: string;
  twilioManager: ReturnType<typeof useTwilioManager> | null;
}

const SoftphoneContext = createContext<SoftphoneContextType | null>(null);

export const useSoftphone = () => {
  const context = useContext(SoftphoneContext);
  if (!context) {
    throw new Error("useSoftphone must be used within a SoftphoneProvider");
  }
  return context;
};

interface SoftphoneProviderProps {
  userId: string;
  children: React.ReactNode;
}

export const SoftphoneProvider = ({ userId, children }: SoftphoneProviderProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [initialPhoneNumber, setInitialPhoneNumber] = useState("");

  const handleIncomingCall = useCallback(() => {
    console.log("Incoming call detected - opening softphone automatically");
    setIsOpen(true);
  }, []);

  const twilioManager = useTwilioManager({
    userId,
    onIncomingCall: handleIncomingCall,
  });

  const openSoftphone = useCallback((phoneNumber?: string) => {
    if (phoneNumber) {
      setInitialPhoneNumber(phoneNumber);
    }
    setIsOpen(true);
  }, []);

  const closeSoftphone = useCallback(() => {
    setIsOpen(false);
    setInitialPhoneNumber("");
  }, []);

  return (
    <SoftphoneContext.Provider
      value={{
        isOpen,
        openSoftphone,
        closeSoftphone,
        initialPhoneNumber,
        twilioManager,
      }}
    >
      {children}
    </SoftphoneContext.Provider>
  );
};
