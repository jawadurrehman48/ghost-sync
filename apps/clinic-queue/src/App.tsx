import { skeleton } from '@skeleton/core';

function App() {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">Clinic Queue</h1>
        <p className="text-gray-600">Patient Tokens for Small Clinics</p>
        <p className="text-sm text-gray-400 mt-4">
          Powered by {skeleton.name} v{skeleton.version}
        </p>
      </div>
    </div>
  );
}

export default App;
