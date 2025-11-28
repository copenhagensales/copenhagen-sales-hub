import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Sidebar } from "@/components/Sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Loader2, Plus, Pencil, Trash2 } from "lucide-react";

interface EmailTemplate {
  id: string;
  name: string;
  template_key: string;
  subject: string;
  content: string;
}

export default function EmailTemplates() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    template_key: "",
    subject: "",
    content: "",
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .order("name");

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error("Error fetching templates:", error);
      toast.error("Kunne ikke hente skabeloner");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (template?: EmailTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        template_key: template.template_key,
        subject: template.subject,
        content: template.content,
      });
    } else {
      setEditingTemplate(null);
      setFormData({ name: "", template_key: "", subject: "", content: "" });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.template_key || !formData.subject) {
      toast.error("Navn, nøgle og emne er påkrævet");
      return;
    }

    setSaving(true);
    try {
      if (editingTemplate) {
        const { error } = await supabase
          .from("email_templates")
          .update({
            name: formData.name,
            subject: formData.subject,
            content: formData.content,
          })
          .eq("id", editingTemplate.id);

        if (error) throw error;
        toast.success("Skabelon opdateret");
      } else {
        const { error } = await supabase
          .from("email_templates")
          .insert({
            name: formData.name,
            template_key: formData.template_key,
            subject: formData.subject,
            content: formData.content,
          });

        if (error) throw error;
        toast.success("Skabelon oprettet");
      }

      setDialogOpen(false);
      fetchTemplates();
    } catch (error: any) {
      console.error("Error saving template:", error);
      if (error.code === "23505") {
        toast.error("En skabelon med denne nøgle findes allerede");
      } else {
        toast.error("Kunne ikke gemme skabelon");
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Er du sikker på at du vil slette denne skabelon?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("email_templates")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Skabelon slettet");
      fetchTemplates();
    } catch (error) {
      console.error("Error deleting template:", error);
      toast.error("Kunne ikke slette skabelon");
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full">
      <Sidebar />
      <main className="flex-1 overflow-auto">
        <div className="container max-w-6xl py-8">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-3xl font-bold">Email-skabeloner</h1>
              <p className="text-muted-foreground mt-2">
                Administrer email-skabeloner. Brug {"{{fornavn}}"} og {"{{rolle}}"} som variable.
              </p>
            </div>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Ny skabelon
            </Button>
          </div>

          <div className="grid gap-4">
            {templates.map((template) => (
              <Card key={template.id}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle>{template.name}</CardTitle>
                      <CardDescription className="mt-1">
                        Nøgle: {template.template_key}
                      </CardDescription>
                      <CardDescription className="mt-2 font-semibold">
                        Emne: {template.subject}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenDialog(template)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDelete(template.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{template.content}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? "Rediger skabelon" : "Ny skabelon"}
            </DialogTitle>
            <DialogDescription>
              Brug {"{{fornavn}}"} og {"{{rolle}}"} som variable i emne og besked.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Navn</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="F.eks. Tak for ansøgning"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="template_key">Nøgle (unik identifikator)</Label>
              <Input
                id="template_key"
                value={formData.template_key}
                onChange={(e) =>
                  setFormData({ ...formData, template_key: e.target.value })
                }
                placeholder="F.eks. tak_for_ansoegning"
                disabled={!!editingTemplate}
              />
              {editingTemplate && (
                <p className="text-xs text-muted-foreground">
                  Nøglen kan ikke ændres efter oprettelse
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="subject">Email emne</Label>
              <Input
                id="subject"
                value={formData.subject}
                onChange={(e) =>
                  setFormData({ ...formData, subject: e.target.value })
                }
                placeholder="F.eks. Tak for din ansøgning"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="content">Email indhold</Label>
              <Textarea
                id="content"
                value={formData.content}
                onChange={(e) =>
                  setFormData({ ...formData, content: e.target.value })
                }
                placeholder="Hej {{fornavn}}! ..."
                rows={8}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Annuller
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Gem
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
