import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';

// Helper component to keep the scene rendering
const AutoInvalidate = () => {
  const { invalidate } = useThree();
  
  useEffect(() => {
    // Set up interval to ensure regular rendering
    const id = setInterval(() => {
      invalidate();
    }, 100); // 10fps is enough for development
    
    return () => clearInterval(id);
  }, [invalidate]);
  
  return null;
};

export default AutoInvalidate; 