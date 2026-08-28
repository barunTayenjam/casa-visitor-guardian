import React, { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { personService, FaceCluster } from '@/services/api/personService';
import { Users, Tag, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const PeoplePage: React.FC = () => {
  const { toast } = useToast();
  const [clusters, setClusters] = useState<FaceCluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [namingClusterId, setNamingClusterId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [isNaming, setIsNaming] = useState(false);

  const fetchClusters = useCallback(async () => {
    setLoading(true);
    try {
      const response = await personService.getFaceClusters();
      if (response.success && response.clusters) {
        setClusters(response.clusters);
      } else {
        toast({
          title: 'Error',
          description: response.error || 'Failed to fetch face clusters',
          variant: 'destructive',
        });
      }
    } catch {
      toast({ title: 'Error', description: 'Failed to fetch face clusters', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchClusters();
  }, [fetchClusters]);

  const handleSaveName = useCallback(
    async (clusterId: string) => {
      if (!newName.trim()) return;
      setIsNaming(true);
      try {
        const response = await personService.assignClusterName(clusterId, newName.trim());
        if (response.success) {
          toast({ title: 'Success', description: `Named "${newName.trim()}"` });
          setNamingClusterId(null);
          setNewName('');
          fetchClusters();
        } else {
          toast({
            title: 'Error',
            description: response.error || 'Failed to assign name',
            variant: 'destructive',
          });
        }
      } finally {
        setIsNaming(false);
      }
    },
    [newName, toast, fetchClusters],
  );

  return (
    <div className="w-full min-h-[100dvh] flex flex-col bg-background">
      {/* SOC Header */}
      <div className="px-5 pt-6 pb-2">
        <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded bg-primary/10 border border-primary/20 text-[9px] uppercase tracking-[0.2em] font-medium text-primary mb-3">
          <Users className="h-3 w-3" />
          Face Recognition
        </div>
        <h1 className="text-2xl font-semibold tracking-tight mb-1">People</h1>
        <p className="text-xs text-muted-foreground mb-4">
          Faces grouped from verified human events. Name them to identify in your timeline.
        </p>
      </div>

      {loading ? (
        <div className="px-5 pb-28 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
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
      ) : clusters.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-5 py-16 text-center px-5">
          <div className="w-14 h-14 rounded-full bg-white/[0.04] flex items-center justify-center border border-white/[0.10]">
            <Users className="h-6 w-6 text-muted-foreground" />
          </div>
          <div className="space-y-1.5">
            <h3 className="text-base font-medium">No Faces Clustered Yet</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Faces will appear here once the clustering pipeline runs on your events.
            </p>
          </div>
        </div>
      ) : (
        <div className="px-5 pb-28 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {clusters.map((cluster) => (
            <div key={cluster.cluster_id} className="group rounded-[0.5rem] border border-white/[0.10] bg-card overflow-hidden hover:border-primary/30 transition-colors">
              <div className="relative aspect-square overflow-hidden bg-black/50 flex items-center justify-center">
                <img
                  src={cluster.representative_image}
                  alt={cluster.name || cluster.cluster_id}
                  className="max-w-full max-h-full object-contain transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                <div className="absolute bottom-2 left-3 right-3">
                  <p className="text-white text-sm font-medium truncate">
                    {cluster.name || 'Unidentified'}
                  </p>
                  <p className="text-white/60 text-[10px]">
                    {cluster.face_count} face{cluster.face_count > 1 ? 's' : ''}
                  </p>
                </div>
              </div>
              <div className="p-3">
                {namingClusterId === cluster.cluster_id ? (
                  <div className="flex gap-2">
                    <Input
                      autoFocus
                      placeholder="Enter name"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveName(cluster.cluster_id);
                        if (e.key === 'Escape') {
                          setNamingClusterId(null);
                          setNewName('');
                        }
                      }}
                      className="h-8 text-xs bg-white/[0.04] border-white/[0.10] focus-visible:ring-primary/30"
                      disabled={isNaming}
                    />
                    <Button
                      size="sm"
                      className="h-8 px-3"
                      onClick={() => handleSaveName(cluster.cluster_id)}
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
                      setNamingClusterId(cluster.cluster_id);
                      setNewName(cluster.name || '');
                    }}
                  >
                    <Tag className="h-3 w-3 mr-1.5" />
                    {cluster.name ? 'Rename' : 'Name Person'}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PeoplePage;
