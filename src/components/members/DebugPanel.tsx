import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface DebugData {
  [key: string]: unknown;
}

interface DebugPanelProps {
  eventId: string;
  diag: DebugData;
  setDiag: (updater: (prev: DebugData) => DebugData) => void;
  newMemberName: string;
  newMemberEmail: string;
}

export const DebugPanel = ({ eventId, diag, setDiag, newMemberName, newMemberEmail }: DebugPanelProps) => {
  const debugCheckPermissions = async () => {
    try {
      const { data: debugData, error: debugError } = await supabase.functions.invoke('debug-rls', {
        body: { eventId }
      });

      if (debugError) {
        setDiag((d) => ({ ...d, debugRls: { error: debugError.message } }));
        toast.error('Debug RLS errore');
      } else {
        setDiag((d) => ({ ...d, debugRls: debugData }));
        toast.success('Debug RLS completato');
      }
    } catch (e) {
      console.error('RLS debug failed', e);
      toast.error('Debug RLS errore');
    }
  };

  const debugAddMemberTest = async () => {
    try {
      const name = newMemberName.trim() || 'Test User';
      const email = newMemberEmail.trim() || '';
      const { data: addData, error: addError } = await supabase.functions.invoke('members-add', {
        body: { eventId, anonymousName: name, anonymousEmail: email || null, ttlDays: 1 }
      });

      setDiag((d) => ({ ...d, debugAddResp: addError ? { error: addError.message } : addData }));
      if (addError) toast.error('members/add error');
      else toast.success('members/add OK');
    } catch (e) {
      console.error('debug add failed', e);
      toast.error('Debug add errore');
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-2">
        <Button variant="secondary" size="sm" onClick={debugCheckPermissions}>
          Verifica permessi (RLS)
        </Button>
        <Button variant="secondary" size="sm" onClick={debugAddMemberTest}>
          Test add via API
        </Button>
      </div>
      <pre className="text-xs whitespace-pre-wrap break-words">
        {JSON.stringify({ eventId, ...diag }, null, 2)}
      </pre>
    </Card>
  );
};