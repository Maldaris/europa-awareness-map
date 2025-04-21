# Europa Sphere Visualization - Ray-Sphere Intersection Implementation

## Overview

This document summarizes our work implementing and debugging ray-sphere intersection calculations for the Europa sphere visualization component. The goal was to accurately calculate where a user's mouse cursor intersects with the sphere surface, allowing for precise marker placement.

## Initial Implementation Challenges

We started with implementing a ray-sphere intersection calculation in the `EuropaSphere.tsx` component. The initial approach had several issues:

1. **Incorrect vector calculations**: We initially calculated the vector from ray origin to sphere center (`originToSphere`) incorrectly as `spherePosition - rayOrigin`, which produced the opposite of the expected vector.

2. **Quadratic equation sign issues**: This led to incorrect coefficients in our quadratic equation, resulting in negative t values when they should have been positive.

3. **Marker positioning issues**: The intersection marker would appear on the opposite side of the sphere from where the mouse was pointing, essentially mirroring the expected position.

4. **Depth issues**: The marker would sometimes be hidden behind the sphere due to depth testing.

## Ray-Sphere Intersection Theory

The ray-sphere intersection calculation is based on solving the following equations:

1. **Ray equation**: `p(t) = origin + t * direction`
2. **Sphere equation**: `|p - center|² = radius²`

For an intersection, we solve:
`|origin + t * direction - center|² = radius²`

Expanding this:

1. Let `v = origin - center` (vector from sphere center to ray origin)
2. `|v + t * direction|² = radius²`
3. `(v + t * direction)·(v + t * direction) = radius²`
4. `v·v + 2t(v·direction) + t²(direction·direction) = radius²`

This gives us a quadratic equation: `at² + bt + c = 0` where:

- `a = direction·direction` (= 1 for normalized direction)
- `b = 2(v·direction)`
- `c = v·v - radius²`

## Key Corrections Made

1. **Proper vector calculation**: Changed to use `centerToOrigin = rayOrigin - spherePosition` to correctly calculate the vector from sphere center to ray origin.

2. **Three.js Raycaster**: Switched to using Three.js's built-in Raycaster for more reliable ray generation from camera and mouse coordinates.

3. **Proper quadratic coefficient calculation**:

   ```javascript
   const a = rayDirection.dot(rayDirection);
   const b = 2 * centerToOrigin.dot(rayDirection);
   const c = centerToOrigin.dot(centerToOrigin) - radius * radius;
   ```

4. **Correct intersection selection**: When finding the intersection point, we use `Math.min(t1, t2)` to get the closest intersection point.

5. **Visible marker**: Made the intersection marker always visible by setting `depthTest={false}` on its material.

## Final Implementation Details

The final implementation:

1. Uses the canvas bounding rectangle to determine normalized device coordinates (NDC) from mouse position
2. Creates a ray using Three.js's Raycaster from the camera through the mouse point
3. Calculates the ray-sphere intersection using the quadratic formula
4. Finds the closest intersection point (using the smaller t value)
5. Calculates the normal at the intersection point
6. Sets the intersection point on the sphere's surface
7. Renders a marker at the intersection point with depth testing disabled

## Code Insights

Key parts of the solution:

```javascript
// Vector from sphere center to ray origin (correct vector for formula)
const centerToOrigin = rayOrigin.clone().sub(spherePosition);

// Coefficients of quadratic equation using standard ray-sphere intersection formula
const a = rayDirection.dot(rayDirection); 
const b = 2 * centerToOrigin.dot(rayDirection);
const c = centerToOrigin.dot(centerToOrigin) - radius * radius;

// Calculate discriminant
const discriminant = b * b - 4 * a * c;

if (discriminant >= 0) {
  // Calculate both intersection points
  const t1 = (-b - Math.sqrt(discriminant)) / (2 * a);
  const t2 = (-b + Math.sqrt(discriminant)) / (2 * a);
  
  // Get the closer intersection (smaller t value)
  let t = Math.min(t1, t2);
  
  // Calculate the intersection point and normal
  const intersectionPoint = rayOrigin.clone().add(rayDirection.clone().multiplyScalar(t));
  const normal = intersectionPoint.clone().sub(spherePosition).normalize();
  const finalPosition = spherePosition.clone().add(normal.multiplyScalar(radius));
}
```

## Marker Visibility

To ensure the marker is always visible, we used:

```jsx
<meshBasicMaterial 
  color="#00ff00" 
  transparent={true} 
  opacity={0.8} 
  depthTest={false} 
/>
```

## Lessons Learned

1. **Vector direction matters**: In geometric calculations, the direction of vectors is crucial. Getting the sign wrong can completely invert expected results.

2. **Use native tools when available**: Three.js's Raycaster handles the complexities of camera projection and ray creation.

3. **Debug with visualization**: Logging vector values and intersection parameters helped identify where the calculation was going wrong.

4. **Understand the underlying math**: Having a solid grasp of the ray-sphere intersection formula was key to identifying and fixing issues.

5. **Choose the right t value**: When multiple intersections exist, selecting the correct t value (in this case, the minimum) ensures we get the expected intersection point.

6. **Consider depth testing**: For UI elements like markers, disabling depth testing can ensure visibility regardless of camera angle.
