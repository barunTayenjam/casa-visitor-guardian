import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, UserCheck, Calendar, Image } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import apiService, { ApiError } from '@/services/ApiService';

interface Person {
  personId: string;
  imageCount: number;
  firstSeen: string;
  lastSeen: string;
}

interface AnalysisResult {
  totalImages: number;
  processedImages: number;
  personsIdentified: number;
}

const PersonAnalysis = () => {
  const { toast } = useToast();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [persons, setPersons] = useState<Person[]>([]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  const startAnalysis = async () => {
    setIsAnalyzing(true);
    try {
      const response = await apiService.analyzePersons();
      setResult(response.result);
      setPersons(response.persons);
      toast({
        title: 'Analysis Complete',
        description: `Identified ${response.result.personsIdentified} unique persons from ${response.result.processedImages} images.`,
      });
    } catch (error) {
      console.error('Failed to analyze persons:', error);
      toast({
        title: 'Error',
        description: `Failed to analyze persons: ${error instanceof ApiError ? error.message : String(error)}`,
        variant: 'destructive',
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Person Analysis</CardTitle>
          <CardDescription>
            Analyze saved images to identify and organize unique persons.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              This tool will analyze all saved images from motion events and snapshots, 
              identify unique persons using facial recognition, and organize them into separate folders.
            </p>
            
            {result && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                <div className="flex items-center space-x-2 p-4 border rounded-md">
                  <Image className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Images Processed</p>
                    <p className="text-2xl font-bold">{result.processedImages} / {result.totalImages}</p>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2 p-4 border rounded-md">
                  <UserCheck className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-sm font-medium">Persons Identified</p>
                    <p className="text-2xl font-bold">{result.personsIdentified}</p>
                  </div>
                </div>
              </div>
            )}
            
            {persons.length > 0 && (
              <div className="mt-6">
                <h3 className="text-lg font-medium mb-2">Identified Persons</h3>
                <div className="space-y-2">
                  {persons.map((person) => (
                    <Card key={person.personId}>
                      <CardContent className="p-4">
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-medium">{person.personId.replace('person_', 'Person ')}</h4>
                            <div className="flex items-center space-x-2 text-sm text-muted-foreground mt-1">
                              <Calendar className="h-4 w-4" />
                              <span>First seen: {formatDate(person.firstSeen)}</span>
                            </div>
                            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              <span>Last seen: {formatDate(person.lastSeen)}</span>
                            </div>
                          </div>
                          <Badge variant="outline" className="ml-2">
                            {person.imageCount} {person.imageCount === 1 ? 'image' : 'images'}
                          </Badge>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            onClick={startAnalysis} 
            disabled={isAnalyzing}
            className="w-full"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Analyzing Images...
              </>
            ) : (
              'Start Person Analysis'
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default PersonAnalysis;