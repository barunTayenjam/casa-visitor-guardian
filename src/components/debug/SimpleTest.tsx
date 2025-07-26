import { Card } from '@/components/ui/card';

export const SimpleTest = () => {
  return (
    <Card className="p-4 m-4 bg-green-50 border-green-200">
      <h3 className="text-green-800 font-bold">✅ React Components Working</h3>
      <p className="text-green-700">If you can see this, the React app is rendering correctly.</p>
      <div className="mt-2 text-sm text-green-600">
        <div>• Navigation should work</div>
        <div>• Settings button should work</div>
        <div>• All tabs should be functional</div>
      </div>
    </Card>
  );
};