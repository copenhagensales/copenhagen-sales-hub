import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Upload, FileSpreadsheet, AlertCircle } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import * as XLSX from 'xlsx';

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface ImportSummary {
  total: number;
  applicationsCreated: number;
  candidatesNotFound: number;
  errors: string[];
  teamsAssigned?: number;
}

export function BulkImportDialog({ open, onOpenChange, onSuccess }: BulkImportDialogProps) {
  const [loading, setLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [employeeFile, setEmployeeFile] = useState<File | null>(null);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      setImportSummary(null);
    }
  };

  const handleEmployeeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEmployeeFile(file);
    }
  };

  const parseExcelFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Kunne ikke læse filen'));
      reader.readAsBinaryString(file);
    });
  };

  const handleImport = async () => {
    if (!selectedFile) {
      toast.error("Vælg en kandidatfil");
      return;
    }

    try {
      setLoading(true);
      
      // Parse candidate Excel file
      const candidateData = await parseExcelFile(selectedFile);
      
      if (candidateData.length === 0) {
        toast.error("Ingen data fundet i kandidat-filen");
        return;
      }

      // Map Excel columns to our format for candidates
      const candidates = candidateData.map((row: any) => ({
        first_name: row.Fornavn || "",
        last_name: row.Efternavn || "",
        email: row.Email || "",
        phone: row.Telefonnummer ? String(row.Telefonnummer) : "",
        status: row.Status || "startet",
        source: row.Kilde || "Hjemmesiden",
        notes: row["Noter/beskeder fra kandidaten"] || row.notes || "",
        application_date: row.Ansøgningsdato || new Date().toISOString().split('T')[0],
      }));

      console.log(`Parsed ${candidates.length} candidates from Excel`);

      // Parse employee file if provided for team mapping
      let employees = null;
      if (employeeFile) {
        const employeeData = await parseExcelFile(employeeFile);
        employees = employeeData.map((row: any) => ({
          email: row.Email || "",
          team: row.Medarbejdergrupper || "",
          full_name: row["Fulde navn"] || "",
        }));
        console.log(`Parsed ${employees.length} employees for team mapping`);
      }

      // Call edge function to add applications to existing candidates
      const { data, error } = await supabase.functions.invoke('add-applications-to-existing', {
        body: { candidates, employees },
      });

      if (error) {
        console.error("Import error:", error);
        throw error;
      }

      console.log("Import result:", data);

      setImportSummary(data);
      
      if (data.applicationsCreated > 0) {
        toast.success(`${data.applicationsCreated} ansøgninger oprettet!${data.teamsAssigned > 0 ? ` ${data.teamsAssigned} teams tildelt.` : ''}`);
        onSuccess();
      }

      if (data.candidatesNotFound > 0) {
        toast.info(`${data.candidatesNotFound} kandidater blev ikke fundet i databasen`);
      }

      if (data.errors && data.errors.length > 0) {
        toast.warning(`${data.errors.length} fejl opstod under importen`);
      }

    } catch (error: any) {
      console.error("Import error:", error);
      toast.error(error.message || "Kunne ikke importere kandidater");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedFile(null);
    setEmployeeFile(null);
    setImportSummary(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Bulk Import af Kandidater</DialogTitle>
          <DialogDescription>
            Upload Excel-fil med kandidatansøgningsdata for at tilføje ansøgninger til eksisterende kandidater.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Alert>
            <FileSpreadsheet className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <div>
                  <strong>Kandidat-fil:</strong> Excel-filen skal indeholde kolonner: Fornavn, Efternavn, Email, Telefonnummer, Status, Kilde, Noter/beskeder fra kandidaten, Ansøgningsdato
                </div>
                <div>
                  <strong>Valgfri medarbejder-fil:</strong> Upload også medarbejder-filen for at tildele teams automatisk til ansatte
                </div>
                <a 
                  href="/import-skabelon.csv" 
                  download="kandidat-import-skabelon.csv"
                  className="text-sm text-primary hover:underline inline-flex items-center gap-1"
                >
                  <FileSpreadsheet className="h-3 w-3" />
                  Download Excel skabelon
                </a>
              </div>
            </AlertDescription>
          </Alert>

          <div>
            <Label htmlFor="file">Kandidat Excel fil (påkrævet)</Label>
            <div className="mt-2">
              <input
                id="file"
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                className="block w-full text-sm text-foreground
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-medium
                  file:bg-primary file:text-primary-foreground
                  hover:file:bg-primary/90
                  file:cursor-pointer cursor-pointer"
              />
            </div>
            {selectedFile && (
              <p className="text-sm text-muted-foreground mt-2">
                Valgt fil: {selectedFile.name}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="employeeFile">Medarbejder Excel fil (valgfri - for team-matching)</Label>
            <div className="mt-2">
              <input
                id="employeeFile"
                type="file"
                accept=".xlsx, .xls"
                onChange={handleEmployeeFileChange}
                className="block w-full text-sm text-foreground
                  file:mr-4 file:py-2 file:px-4
                  file:rounded-md file:border-0
                  file:text-sm file:font-medium
                  file:bg-secondary file:text-secondary-foreground
                  hover:file:bg-secondary/90
                  file:cursor-pointer cursor-pointer"
              />
            </div>
            {employeeFile && (
              <p className="text-sm text-muted-foreground mt-2">
                Valgt fil: {employeeFile.name}
              </p>
            )}
          </div>

          {importSummary && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-1">
                  <div className="font-semibold">Import resultat:</div>
                  <div>Total: {importSummary.total}</div>
                  <div className="text-green-600">Ansøgninger oprettet: {importSummary.applicationsCreated}</div>
                  {importSummary.teamsAssigned && importSummary.teamsAssigned > 0 && (
                    <div className="text-blue-600">Teams tildelt: {importSummary.teamsAssigned}</div>
                  )}
                  <div className="text-orange-600">Kandidater ikke fundet: {importSummary.candidatesNotFound}</div>
                  {importSummary.errors && importSummary.errors.length > 0 && (
                    <div className="text-red-600">
                      <div className="font-medium">Fejl ({importSummary.errors.length}):</div>
                      <ul className="list-disc pl-5 text-xs mt-1">
                        {importSummary.errors.slice(0, 3).map((err, idx) => (
                          <li key={idx}>{err}</li>
                        ))}
                        {importSummary.errors.length > 3 && (
                          <li>... og {importSummary.errors.length - 3} flere</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-2">
            <Button
              onClick={handleImport}
              disabled={loading || !selectedFile}
              className="flex-1"
            >
              {loading ? (
                "Importerer..."
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Importer kandidater
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleClose}
              disabled={loading}
            >
              Luk
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}