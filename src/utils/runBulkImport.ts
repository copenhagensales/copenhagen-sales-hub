// Temporary script to import historical candidates
// This file can be deleted after import is complete

import { supabase } from "@/integrations/supabase/client";

// Sample data structure - full dataset should be added here
const candidates = [
  {
    first_name: "Engin",
    last_name: "Bozkir",
    email: "e_ngin_95@hotmail.com",
    phone: "4553500676",
    status: "ikke_kvalificeret",
    source: "Hjemmesiden",
    notes: "Kære rette modtager i Copenhagen Sales...",
    application_date: "2025-11-24"
  },
  // Add all ~560 candidates here from the Excel file
];

export async function runBulkImport() {
  console.log(`Starting import of ${candidates.length} candidates...`);
  
  const { data, error } = await supabase.functions.invoke('bulk-import-candidates', {
    body: { candidates },
  });

  if (error) {
    console.error("Import error:", error);
    throw error;
  }

  console.log("Import completed:", data);
  return data;
}