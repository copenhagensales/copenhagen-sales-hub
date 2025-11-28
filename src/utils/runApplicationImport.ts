// Script to add applications to existing 560 candidates
import { supabase } from "@/integrations/supabase/client";

// Candidate application data from Kontakter_renset_klar_til_import_med_ansøgningsdato-2.xlsx
const candidatesData = [
  { email: "e_ngin_95@hotmail.com", phone: "4553500676", status: "ikke_kvalificeret", notes: "Kære rette modtager i Copenhagen Sales...", application_date: "2025-11-24" },
  { email: "atillakhanbul05@gmail.com", phone: "4530848529", status: "ghostet", notes: "tog den ikk", application_date: "2025-11-24" },
  { email: "beckjonas79@gmail.com", phone: "4581928211", status: "udskudt_samtale", notes: "34, Har barn. har arbejdet i telenor og CBB.", application_date: "2025-11-24" },
  { email: "nilswick@icloud.com", phone: "4526220523", status: "ghostet", notes: "Skal til samtale hos noget byggemarked Torsdag...", application_date: "2025-11-23" },
  { email: "carolinememhave@gmail.com", phone: "4522880427", status: "ghostet", notes: "Tog den ike", application_date: "2025-11-23" },
  { email: "ismo.24@hotmail.com", phone: "4593830563", status: "ghostet", notes: "Hej Mit navn er Ismail...", application_date: "2025-11-23" },
  { email: "livaholmbom@gmail.com", phone: "4523478490", status: "ghostet", notes: "Ville kunne starte i januar i februrat", application_date: "2025-11-22" },
  { email: "juliusvase@gmail.com", phone: "4553601217", status: "ghostet", notes: "Ringer i morgen", application_date: "2025-11-21" },
  { email: "davidchristianlarsen@gmail.com", phone: "4561691490", status: "ghostet", notes: "Lyder sku meget nice...", application_date: "2025-11-21" },
  // Add all remaining candidates here from the Excel file...
];

// Employee data for team mapping from IntraManager_Work-users.xlsx
const employeesData = [
  { email: "andersflyhansen@gmail.com", team: "Team: United" },
  { email: "hector@amden.dk", team: "Team: United" },
  { email: "Isaacmadsen02@gmail.com", team: "Team: Eesy TM" },
  { email: "Tanjam.mathies@gmail.com", team: "Team: Fieldmarketing" },
  { email: "villadsbjerre@gmail.com", team: "Team: Fieldmarketing" },
  { email: "alexanderbanda0312@icloud.com", team: "Team: Eesy TM" },
  { email: "Alexander.fabiani2@icloud.com", team: "Relatel Kundeservice" },
  { email: "aen2903@gmail.com", team: "Team: Eesy TM" },
  { email: "Alexandercallesen@gmail.com", team: "Team: United" },
  { email: "alexanderjacobsen07@gmail.com", team: "Team: United" },
  { email: "thulinalexander8@gmail.com", team: "Team: Eesy TM" },
  { email: "alfredrud04@gmail.com", team: "Rekruttering & SoMe" },
  { email: "Anders.qualmann@gmail.com", team: "Team: Eesy TM" },
  { email: "andreasss3010@gmail.com", team: "Team: United" },
  { email: "Degn2707@gmail.com", team: "Team: Eesy TM" },
  { email: "annagwolff@gmail.com", team: "Team: Relatel" },
  { email: "sondergaardannika@gmail.com", team: "Team: United" },
  { email: "Arthur.steenberg@gmail.com", team: "Team: TDC" },
  { email: "Asgerhushan@gmail.com", team: "Team: Eesy TM" },
  { email: "axelhp2002@outlook.dk", team: "Team: United" },
  // ... add all employees
];

export async function runApplicationImport() {
  console.log(`Starting application import for ${candidatesData.length} candidates...`);
  
  const { data, error } = await supabase.functions.invoke('add-applications-to-existing', {
    body: { 
      candidates: candidatesData,
      employees: employeesData 
    },
  });

  if (error) {
    console.error("Import error:", error);
    throw error;
  }

  console.log("Import completed:", data);
  return data;
}
