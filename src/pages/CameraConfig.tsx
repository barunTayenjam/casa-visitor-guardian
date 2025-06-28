
import { useState } from 'react';
import { Camera, Plus, Trash2 } from 'lucide-react';
import { Camera as CameraType } from '@/types/security';
import { useCameras } from '@/contexts/CameraContext';
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

interface CameraFormData {
  name: string;
  location: string;
  streamUrl: string;
  detectionEnabled: boolean;
  sensitivity: number;
  resolution: string;
  fps: number;
}

const CameraConfig = () => {
  const { toast } = useToast();
  const { cameras, addCamera, updateCamera, deleteCamera } = useCameras();
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
      resolution: '1920x1080',
      fps: 30,
    }
  });

  const openNewCameraDialog = () => {
    form.reset({
      name: '',
      location: '',
      streamUrl: '',
      detectionEnabled: true,
      sensitivity: 0.75,
      resolution: '1920x1080',
      fps: 30,
    });
    setIsEditing(false);
    setCurrentCameraId(null);
    setDialogOpen(true);
  };

  const openEditCameraDialog = (camera: CameraType) => {
    form.reset({
      name: camera.name,
      location: camera.location,
      streamUrl: camera.streamUrl,
      detectionEnabled: camera.detectionEnabled,
      sensitivity: camera.sensitivity,
      resolution: camera.resolution,
      fps: camera.fps,
    });
    setCurrentCameraId(camera.id);
    setIsEditing(true);
    setDialogOpen(true);
  };

  const handleAddCamera = (data: CameraFormData) => {
    addCamera({
      name: data.name,
      location: data.location,
      streamUrl: data.streamUrl,
      detectionEnabled: data.detectionEnabled,
      sensitivity: data.sensitivity,
      resolution: data.resolution,
      fps: data.fps,
    });

    setDialogOpen(false);
    toast({
      title: "Camera Added",
      description: `${data.name} has been added successfully.`,
    });
  };

  const handleUpdateCamera = (data: CameraFormData) => {
    if (!currentCameraId) return;
    
    updateCamera(currentCameraId, {
      name: data.name,
      location: data.location,
      streamUrl: data.streamUrl,
      detectionEnabled: data.detectionEnabled,
      sensitivity: data.sensitivity,
      resolution: data.resolution,
      fps: data.fps,
    });

    setDialogOpen(false);
    toast({
      title: "Camera Updated",
      description: `${data.name} has been updated successfully.`,
    });
  };

  const handleDeleteCamera = (id: string) => {
    const cameraToDelete = cameras.find(camera => camera.id === id);
    if (!cameraToDelete) return;

    deleteCamera(id);
    
    toast({
      title: "Camera Removed",
      description: `${cameraToDelete.name} has been removed from your system.`,
    });
  };

  const testConnection = async (streamUrl: string) => {
    if (!streamUrl) {
      toast({
        title: "Invalid URL",
        description: "Please enter a valid RTSP URL",
        variant: "destructive",
      });
      return false;
    }

    // Simulate connection test - in real app, this would ping the RTSP stream
    const isSuccessful = Math.random() > 0.3; // 70% success rate for demo
    
    toast({
      title: isSuccessful ? "Connection Successful" : "Connection Failed",
      description: isSuccessful 
        ? "Successfully connected to the camera stream." 
        : "Could not connect to the camera. Please check the URL and credentials.",
      variant: isSuccessful ? "default" : "destructive",
    });
    
    return isSuccessful;
  };

  const onSubmit = (data: CameraFormData) => {
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
              
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="resolution"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Resolution</FormLabel>
                      <FormControl>
                        <Input placeholder="1920x1080" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                
                <FormField
                  control={form.control}
                  name="fps"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>FPS</FormLabel>
                      <FormControl>
                        <Input 
                          type="number" 
                          placeholder="30" 
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value) || 30)}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
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
