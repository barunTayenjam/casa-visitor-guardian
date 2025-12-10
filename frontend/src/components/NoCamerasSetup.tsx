import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Camera, Plus, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const NoCamerasSetup = () => {
  const navigate = useNavigate();

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 rounded-full flex items-center justify-center">
            <Camera className="w-8 h-8 text-gray-500" />
          </div>
          <CardTitle className="text-xl">No Cameras Configured</CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-4">
          <p className="text-gray-600">
            Set up your first camera to start monitoring your home security system.
          </p>
          <div className="flex flex-col gap-2">
            <Button 
              onClick={() => navigate('/app/camera-config')}
              className="w-full"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Camera
            </Button>
            <Button 
              variant="outline"
              onClick={() => navigate('/app/settings')}
              className="w-full"
            >
              <Settings className="w-4 h-4 mr-2" />
              Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default NoCamerasSetup;