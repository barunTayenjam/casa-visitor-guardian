
import { useState } from 'react';
import { Camera, Plus, Trash2, Save, X } from 'lucide-react';
import { Camera as CameraType } from '@/types/security';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter,
  DialogDescription
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { Badge } from '@/components/ui/badge';
import { useToast } from "@/hooks/use-toast";

const CameraConfig = () => {
  const { toast } = useToast();
  const [cameras, setCameras] = useState<CameraType[]>([
    {
      id: 'cam1',
      name: 'Front Door',
      status: 'online',
      streamUrl: 'rtsp://username:password@192.168.1.100:554/stream1',
      thumbnail: '/placeholder-camera.jpg',
      location: 'Main Entrance',
      detectionEnabled: true,
      sensitivity: 0.75,
      lastSeen: new Date(),
      resolution: '1920x1080',
      fps: 30
    },
    {
      id: 'cam2',
      name: 'Backyard',
      status: 'online',
      streamUrl: 'rtsp://username:password@192.168.1.101:554/stream1',
      thumbnail: '/placeholder-camera.jpg',
      location: 'Garden Area',
      detectionEnabled: true,
      sensitivity: 0.60,
      lastSeen: new Date(),
      resolution: '1920x1080',
      fps: 30
    },
    {
      id: 'cam3',
      name: 'Garage',
      status: 'offline',
      streamUrl: 'rtsp://username:password@192.168.1.102:554/stream1',
      thumbnail: '/placeholder-camera.jpg',
      location: 'Garage Entrance',
      detectionEnabled: false,
      sensitivity: 0.65,
      lastSeen: new Date(Date.now() - 15 * 60 * 1000),
      resolution: '1280x720',
      fps: 15
    }
  ]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentCameraId, setCurrentCameraId] = useState<string | null>(null);

  const form = useForm({
    defaultValues: {
      name: '',
      location: '',
      streamUrl: '',
      detectionEnabled: true,
      sensitivity: 0.75,
    }
  });

  const openNewCameraDialog = () => {
    form.reset({
      name: '',
      location: '',
      streamUrl: '',
      detectionEnabled: true,
      sensitivity: 0.75,
    });
    setIsEditing(false);
    setDialogOpen(true);
  };

  const openEditCameraDialog = (camera: CameraType) => {
    form.reset({
      name: camera.name,
      location: camera.location,
      streamUrl: camera.streamUrl,
      detectionEnabled: camera.detectionEnabled,
      sensitivity: camera.sensitivity,
    });
    setCurrentCameraId(camera.id);
    setIsEditing(true);
    setDialogOpen(true);
  };

  const handleAddCamera = (data: any) => {
    const newCamera: CameraType = {
      id: `cam${Date.now()}`,
      name: data.name,
      location: data.location,
      status: 'offline',
      streamUrl: data.streamUrl,
      thumbnail: '/placeholder-camera.jpg',
      detectionEnabled: data.detectionEnabled,
      sensitivity: data.sensitivity,
      lastSeen: new Date(),
      resolution: '1920x1080',
      fps: 30
    };

    setCameras([...cameras, newCamera]);
    setDialogOpen(false);
    toast({
      title: "Camera Added",
      description: `${newCamera.name} has been added successfully.`,
    });
  };

  const handleUpdateCamera = (data: any) => {
    if (!currentCameraId) return;
    
    const updatedCameras = cameras.map(camera => {
      if (camera.id === currentCameraId) {
        return {
          ...camera,
          name: data.name,
          location: data.location,
          streamUrl: data.streamUrl,
          detectionEnabled: data.detectionEnabled,
          sensitivity: data.sensitivity,
        };
      }
      return camera;
    });

    setCameras(updatedCameras);
    setDialogOpen(false);
    toast({
      title: "Camera Updated",
      description: `${data.name} has been updated successfully.`,
    });
  };

  const handleDeleteCamera = (id: string) => {
    const cameraToDelete = cameras.find(camera => camera.id === id);
    if (!cameraToDelete) return;

    const updatedCameras = cameras.filter(camera => camera.id !== id);
    setCameras(updatedCameras);
    
    toast({
      title: "Camera Removed",
      description: `${cameraToDelete.name} has been removed from your system.`,
    });
  };

  const testConnection = (streamUrl: string) => {
    // In a real application, this would test the RTSP connection
    // For now, we'll simulate a successful connection 80% of the time
    const isSuccessful = Math.random() > 0.2;
    
    toast({
      title: isSuccessful ? "Connection Successful" : "Connection Failed",
      description: isSuccessful 
        ? "Successfully connected to the camera stream." 
        : "Could not connect to the camera. Please check the URL and credentials.",
      variant: isSuccessful ? "default" : "destructive",
    });
    
    return isSuccessful;
  };

  const onSubmit = (data: any) => {
    if (isEditing) {
      handleUpdateCamera(data);
    } else {
      handleAddCamera(data);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Camera Configuration</h1>
          <p className="text-muted-foreground mt-2">
            Configure RTSP cameras for your security system
          </p>
        </div>
        <Button onClick={openNewCameraDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Camera
        </Button>
      </div>

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>RTSP URL</TableHead>
              <TableHead>Detection</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cameras.map((camera) => (
              <TableRow key={camera.id}>
                <TableCell className="font-medium">{camera.name}</TableCell>
                <TableCell>{camera.location}</TableCell>
                <TableCell>
                  <Badge 
                    variant={camera.status === 'online' ? 'default' : 'destructive'}
                    className="bg-opacity-80"
                  >
                    {camera.status}
                  </Badge>
                </TableCell>
                <TableCell className="max-w-[200px] truncate">{camera.streamUrl}</TableCell>
                <TableCell>{camera.detectionEnabled ? 'Enabled' : 'Disabled'}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => openEditCameraDialog(camera)}
                    >
                      Edit
                    </Button>
                    <Button 
                      variant="destructive" 
                      size="sm"
                      onClick={() => handleDeleteCamera(camera.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {cameras.length === 0 && (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  <Camera className="h-8 w-8 mx-auto mb-3 opacity-50" />
                  <p>No cameras configured yet</p>
                  <Button 
                    variant="outline" 
                    className="mt-4" 
                    onClick={openNewCameraDialog}
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Your First Camera
                  </Button>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? 'Edit Camera' : 'Add New Camera'}
            </DialogTitle>
            <DialogDescription>
              {isEditing 
                ? 'Update your camera settings below.' 
                : 'Configure a new RTSP camera for your security system.'}
            </DialogDescription>
          </DialogHeader>
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Camera Name</FormLabel>
                    <FormControl>
                      <Input placeholder="Front Door" {...field} />
                    </FormControl>
                    <FormDescription>
                      A descriptive name for your camera
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="location"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Location</FormLabel>
                    <FormControl>
                      <Input placeholder="Main Entrance" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="streamUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>RTSP Stream URL</FormLabel>
                    <div className="flex gap-2">
                      <FormControl className="flex-1">
                        <Input 
                          placeholder="rtsp://username:password@192.168.1.100:554/stream1" 
                          {...field} 
                        />
                      </FormControl>
                      <Button 
                        type="button" 
                        variant="outline"
                        onClick={() => testConnection(form.getValues("streamUrl"))}
                      >
                        Test
                      </Button>
                    </div>
                    <FormDescription>
                      The RTSP URL including credentials
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <DialogFooter className="mt-6">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit">
                  {isEditing ? 'Update Camera' : 'Add Camera'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CameraConfig;
