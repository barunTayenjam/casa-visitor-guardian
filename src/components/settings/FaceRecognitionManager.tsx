import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import apiService from '@/services/ApiService';
import { Loader2, Plus, RefreshCw, Trash2, User } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';

interface KnownPerson {
  id: string;
  name: string;
  imagePaths: string[];
}

export const FaceRecognitionManager = () => {
  const { toast } = useToast();
  const [persons, setPersons] = useState<KnownPerson[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const loadPersons = useCallback(async () => {
    try {
      setLoading(true);
      const data = await apiService.getKnownPersons();
      setPersons(data);
    } catch (error) {
      console.error('Failed to load known persons:', error);
      toast({
        title: 'Error',
        description: 'Failed to load known persons',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadPersons();
  }, [loadPersons]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
    }
  };

  const handleAddPerson = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName || !selectedFile) {
      toast({
        title: 'Error',
        description: 'Please provide a name and an image',
        variant: 'destructive',
      });
      return;
    }

    try {
      setUploading(true);
      await apiService.addKnownPerson({
        name: newName,
        image: selectedFile
      });

      toast({
        title: 'Success',
        description: `Added face data for ${newName}`,
      });

      setNewName('');
      setSelectedFile(null);
      // Reset file input
      const fileInput = document.getElementById('face-image') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
      
      loadPersons();
    } catch (error) {
      console.error('Failed to add person:', error);
      toast({
        title: 'Error',
        description: 'Failed to add person. Check logs for details.',
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Add New Face</CardTitle>
          <CardDescription>
            Train the system to recognize a new person. Upload a clear photo of their face.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAddPerson} className="space-y-4">
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="name">Person Name</Label>
              <Input
                id="name"
                placeholder="John Doe"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                disabled={uploading}
              />
            </div>
            <div className="grid w-full max-w-sm items-center gap-1.5">
              <Label htmlFor="face-image">Face Image</Label>
              <Input
                id="face-image"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                disabled={uploading}
              />
            </div>
            <Button type="submit" disabled={uploading || !newName || !selectedFile}>
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Training...
                </>
              ) : (
                <>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Person
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Known People</CardTitle>
              <CardDescription>
                List of people the system can recognize.
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={loadPersons} disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[300px] pr-4">
            {persons.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-muted-foreground">
                <User className="h-8 w-8 mb-2 opacity-20" />
                <p>No known people yet</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {persons.map((person) => (
                  <div
                    key={person.id}
                    className="flex items-center justify-between p-3 border rounded-lg bg-card"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium">{person.name}</p>
                        <p className="text-xs text-muted-foreground">ID: {person.id}</p>
                      </div>
                    </div>
                    {/* Delete functionality not yet implemented in backend */}
                    {/* <Button variant="ghost" size="icon" className="text-destructive">
                      <Trash2 className="h-4 w-4" />
                    </Button> */}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};
