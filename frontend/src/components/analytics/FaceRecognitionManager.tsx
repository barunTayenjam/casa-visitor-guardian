import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    loadKnownFaces();
  }, []);

  const loadKnownFaces = async () => {
    try {
      setIsLoading(true);
      // In a real implementation, we would fetch from the backend
      // For now, we'll use mock data
      const mockFaces: KnownFace[] = [
        { id: '1', name: 'John Doe', imageCount: 12, lastTrained: '2025-10-20' },
        { id: '2', name: 'Jane Smith', imageCount: 8, lastTrained: '2025-10-19' },
        { id: '3', name: 'Bob Johnson', imageCount: 5, lastTrained: '2025-10-18' }
      ];
      setKnownFaces(mockFaces);
    } catch (error) {
      console.error('Error loading known faces:', error);
      toast({
        title: 'Error',
        description: 'Failed to load known faces',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

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
      // In a real implementation, we would send the image to the backend
      // For now, we'll simulate the API call
      toast({
        title: 'Success',
        description: `Face for ${personName} added successfully`
      });

      // Reset form
      setPersonName('');
      setSelectedImage(null);
      
      // Reload known faces
      loadKnownFaces();
    } catch (error) {
      console.error('Error adding face:', error);
      toast({
        title: 'Error',
        description: 'Failed to add face',
        variant: 'destructive'
      });
    }
  };

  const handleRetrainModel = async () => {
    setIsTraining(true);
    try {
      // In a real implementation, we would call the retrain endpoint
      // For now, we'll simulate the API call
      toast({
        title: 'Success',
        description: 'Face recognition model retrained successfully'
      });
    } catch (error) {
      console.error('Error retraining model:', error);
      toast({
        title: 'Error',
        description: 'Failed to retrain model',
        variant: 'destructive'
      });
    } finally {
      setIsTraining(false);
    }
  };

  const handleDeleteFace = async (id: string) => {
    try {
      // In a real implementation, we would delete from the backend
      // For now, we'll simulate the API call
      toast({
        title: 'Success',
        description: 'Face removed successfully'
      });
      
      // Update local state
      setKnownFaces(knownFaces.filter(face => face.id !== id));
    } catch (error) {
      console.error('Error deleting face:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove face',
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
        
        <Button onClick={handleRetrainModel} disabled={isTraining}>
          {isTraining ? (
            <>
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
              Training...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4 mr-2" />
              Retrain Model
            </>
          )}
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
                <Button variant="outline" size="sm">
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

export default FaceRecognitionManager;