import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import {
  Upload,
  User,
  Users,
  RefreshCw,
  Trash2,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface KnownFace {
  id: string;
  name: string;
  imageCount: number;
  lastTrained: string;
}

export const FaceRecognitionManager: React.FC = () => {
  const [knownFaces, setKnownFaces] = useState<KnownFace[]>([]);
  const [personName, setPersonName] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [isTraining, setIsTraining] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const loadKnownFaces = useCallback(async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/visitors/faces/known');
      const data = await response.json();

      if (data.success && data.faces) {
        // Transform backend data to component format
        const faces: KnownFace[] = data.faces.map((face: any) => ({
          id: face.id || face.name,
          name: face.name,
          imageCount: face.image_count || face.images || 1,
          lastTrained: face.last_trained || face.created_at || new Date().toISOString().split('T')[0],
        }));
        setKnownFaces(faces);
      } else {
        setKnownFaces([]);
      }
    } catch (error) {
      console.error('Error loading known faces:', error);
      // Don't show toast on initial load - just show empty state
      setKnownFaces([]);
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    loadKnownFaces();
  }, [loadKnownFaces]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setSelectedImage(file);
    }
  };

  const handleAddFace = async () => {
    if (!personName.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a person name',
        variant: 'destructive'
      });
      return;
    }

    if (!selectedImage) {
      toast({
        title: 'Error',
        description: 'Please select an image to upload',
        variant: 'destructive'
      });
      return;
    }

    try {
      const formData = new FormData();
      formData.append('name', personName);
      formData.append('image', selectedImage);

      const response = await fetch('/api/visitors/faces/register', {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: `Face for ${personName} added successfully`
        });

        // Reset form
        setPersonName('');
        setSelectedImage(null);

        // Reload known faces
        loadKnownFaces();
      } else {
        throw new Error(data.error || 'Failed to add face');
      }
    } catch (error) {
      console.error('Error adding face:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add face',
        variant: 'destructive'
      });
    }
  };

  const handleRetrainModel = async () => {
    setIsTraining(true);
    try {
      const response = await fetch('/api/visitors/faces/recognize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'retrain' }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: 'Face recognition model retrained successfully'
        });
      } else {
        throw new Error(data.error || 'Failed to retrain');
      }
    } catch (error) {
      console.error('Error retraining model:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to retrain model',
        variant: 'destructive'
      });
    } finally {
      setIsTraining(false);
    }
  };

  const handleDeleteFace = async (id: string) => {
    try {
      const response = await fetch(`/api/visitors/faces/known/${id}`, {
        method: 'DELETE',
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Success',
          description: 'Face removed successfully'
        });

        // Update local state
        setKnownFaces(knownFaces.filter(face => face.id !== id));
      } else {
        throw new Error(data.error || 'Failed to delete face');
      }
    } catch (error) {
      console.error('Error deleting face:', error);
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to remove face',
        variant: 'destructive'
      });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold">Face Recognition Manager</h2>
          <p className="text-muted-foreground">
            Add and manage known faces for facial recognition
          </p>
        </div>

        <Button onClick={loadKnownFaces} disabled={isLoading} variant="outline" size="sm">
          <RefreshCw className={cn('h-4 w-4 mr-2', isLoading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Add Face Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Add Known Face
          </CardTitle>
          <CardDescription>
            Upload a photo of a person to add them to the recognition database
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="personName">Person Name</Label>
              <Input
                id="personName"
                value={personName}
                onChange={(e) => setPersonName(e.target.value)}
                placeholder="Enter person's name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="faceImage">Face Image</Label>
              <div className="flex items-center gap-2">
                <Input
                  id="faceImage"
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="flex-1"
                />
                <Button variant="outline" size="sm" type="button">
                  <Upload className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {selectedImage && (
            <div className="flex items-center gap-2 p-2 bg-muted rounded">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span className="text-sm">{selectedImage.name}</span>
            </div>
          )}

          <Button
            onClick={handleAddFace}
            disabled={!personName.trim() || !selectedImage}
            className="w-full"
          >
            <User className="h-4 w-4 mr-2" />
            Add Face to Database
          </Button>
        </CardContent>
      </Card>

      {/* Known Faces List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Known Faces ({knownFaces.length})
          </CardTitle>
          <CardDescription>
            Faces in the recognition database
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : knownFaces.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <User className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No known faces in the database</p>
              <p className="text-sm mt-1">Add faces to enable facial recognition</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {knownFaces.map((face) => (
                <div
                  key={face.id}
                  className="border rounded-lg p-4 flex items-center justify-between hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h3 className="font-medium">{face.name}</h3>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{face.imageCount} images</span>
                        <span>•</span>
                        <span>Trained: {face.lastTrained}</span>
                      </div>
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteFace(face.id)}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recognition Tips */}
      <Card>
        <CardHeader>
          <CardTitle>Face Recognition Tips</CardTitle>
          <CardDescription>
            Best practices for accurate face recognition
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <span>Use clear, front-facing photos with good lighting</span>
            </li>
            <li className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <span>Include multiple images per person for better accuracy</span>
            </li>
            <li className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <span>Retrain the model after adding new faces</span>
            </li>
            <li className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
              <span>Ensure faces are well-lit and not obscured</span>
            </li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
};

// Helper function for className
function cn(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

export default FaceRecognitionManager;
