'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { useRenameIdentity, useFaceIdentities } from '@/hooks/useFaceIdentities';
import { Users, Tag, Loader2, ScanFace } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PageContainer } from '@/components/layout/PageContainer';

function timeAgo(iso: string): string {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

const PeoplePage: React.FC = () => {
  const { toast } = useToast();
  const { data: response, isLoading: loading } = useFaceIdentities();
  const renameIdentity = useRenameIdentity();
  const [namingIdentity, setNamingIdentity] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const identities = response?.identities ?? [];
  const isNaming = renameIdentity.isPending;

  useEffect(() => {
    if (response && !response.success) {
      toast({
        title: 'Error',
        description: response.error || 'Failed to fetch face identities',
        variant: 'destructive',
      });
    }
  }, [response, toast]);

  const handleSaveName = useCallback(
    async (identity: string) => {
      if (!newName.trim()) return;
      const result = await renameIdentity.mutateAsync({ identity, name: newName.trim() });
      if (result.success) {
        toast({ title: 'Success', description: `Named "${newName.trim()}"` });
        setNamingIdentity(null);
        setNewName('');
      } else {
        toast({
          title: 'Error',
          description: result.error || 'Failed to rename identity',
          variant: 'destructive',
        });
      }
    },
    [renameIdentity, newName, toast],
  );

  return (
    <PageContainer>
      {/* Header */}
      <div className="pb-4">
          <h1 className="text-2xl font-semibold tracking-[-0.03em] text-foreground">People</h1>
          <p className="mt-1 text-sm text-muted-foreground">
          Faces from verified person events. Name them to identify in your timeline.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-[0.5rem] border border-white/[0.10] bg-card animate-pulse">
              <div className="aspect-square bg-white/[0.04] rounded-t-[0.5rem]" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-white/[0.06] rounded w-3/4" />
                <div className="h-3 bg-white/[0.04] rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : identities.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-5 py-16 text-center px-5">
          <div className="w-14 h-14 rounded-full bg-white/[0.04] flex items-center justify-center border border-white/[0.10]">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-medium">No Faces Detected Yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Faces will appear here once the cameras detect and verify people.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {identities.map((person) => {
            const isUnknown = person.identity === 'unknown';
            const displayName = isUnknown ? 'Unknown' : person.identity;
            return (
              <div key={person.identity} className="group rounded-[0.5rem] border border-white/[0.10] bg-card overflow-hidden hover:border-primary/30 transition-colors">
                <div className="relative aspect-square overflow-hidden bg-black/50 flex items-center justify-center">
                  {person.representative_image ? (
                    <img
                      src={person.representative_image}
                      alt={displayName}
                      className="max-w-full max-h-full object-contain transition-transform duration-500 ease-spring group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex items-center justify-center w-full h-full bg-white/[0.04]">
                      <ScanFace className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                  <div className="absolute bottom-2 left-3 right-3">
                    <p className="text-white text-sm font-medium truncate">
                      {displayName}
                    </p>
                    <p className="text-white/60 text-xs">
                      {person.event_count} appearance{person.event_count > 1 ? 's' : ''}
                      {' · '}{timeAgo(person.last_seen)}
                    </p>
                  </div>
                </div>
                <div className="p-3">
                  {namingIdentity === person.identity ? (
                    <div className="flex gap-2">
                      <Input
                        autoFocus
                        placeholder="Enter name"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveName(person.identity);
                          if (e.key === 'Escape') {
                            setNamingIdentity(null);
                            setNewName('');
                          }
                        }}
                        className="h-8 text-xs bg-white/[0.04] border-white/[0.10] focus-visible:ring-primary/30"
                        disabled={isNaming}
                      />
                      <Button
                        size="sm"
                        className="h-8 px-3"
                        onClick={() => handleSaveName(person.identity)}
                        disabled={isNaming || !newName.trim()}
                      >
                        {isNaming ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          <Tag className="h-3 w-3" />
                        )}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-8 text-xs bg-white/[0.04] border-white/[0.10] hover:bg-white/[0.08]"
                      onClick={() => {
                        setNamingIdentity(person.identity);
                        setNewName(isUnknown ? '' : person.identity);
                      }}
                    >
                      <Tag className="h-3 w-3 mr-1.5" />
                      {isUnknown ? 'Name Person' : 'Rename'}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </PageContainer>
  );
};

export default PeoplePage;