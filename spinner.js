class Shape3D {
    constructor() {
        this.updateDimensions();
        this.angleX = 0;
        this.angleY = 0;
        this.angleZ = 0;
        this.zoom = 0.8; // Starting with a closer zoom
        this.screen = Array(this.height).fill().map(() => Array(this.width).fill(' '));
        this.zBuffer = Array(this.height).fill().map(() => Array(this.width).fill(-Infinity));
        this.currentShape = 'cube';
        this.shadeChars = ' ░▒▓█'.split('');
        // Simple but effective character set
        this.sphereChars = '   ....::::ooooOOOO@@@@'.split('');
        // Clean but detailed character set for sphere
        // this.sphereChars = ' .·˙:•∙◦●'.split('');
        // Simplified, cleaner character set for sphere
        // this.sphereChars = ' .·:*oO@'.split('');
        // Enhanced character set for sphere
        // this.sphereChars = ' .:;-=+*#%@'.split('');
        // Dense character set for detailed areas
        // this.denseChars = '  .\'`^",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$'.split('');
        
        // Mouse control state
        this.isDragging = false;
        this.lastMouseX = 0;
        this.lastMouseY = 0;
        this.mouseSensitivity = 0.005;
        this.zoomSensitivity = 0.001;
        
        // Add resize handler
        window.addEventListener('resize', () => {
            this.updateDimensions();
            this.initializeBuffers();
            this.update();
        });
        
        // Add mouse event listeners
        const canvas = document.getElementById('canvas');
        canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        document.addEventListener('mousemove', this.handleMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleMouseUp.bind(this));
        canvas.addEventListener('wheel', this.handleWheel.bind(this));
        
        // Prevent text selection while dragging
        canvas.addEventListener('selectstart', e => e.preventDefault());
    }

    updateDimensions() {
        const canvas = document.getElementById('canvas');
        const computedStyle = window.getComputedStyle(canvas);
        const fontWidth = parseFloat(computedStyle.fontSize) * 0.6; // Approximate character width
        const fontHeight = parseFloat(computedStyle.lineHeight) || parseFloat(computedStyle.fontSize) * 1.2;
        
        // Use window dimensions directly for full screen
        this.width = Math.floor(window.innerWidth / fontWidth);
        this.height = Math.floor(window.innerHeight / fontHeight);
        
        // Center the output in the canvas
        canvas.style.display = 'flex';
        canvas.style.alignItems = 'center';
        canvas.style.justifyContent = 'center';
    }

    initializeBuffers() {
        this.screen = Array(this.height).fill().map(() => Array(this.width).fill(' '));
        this.zBuffer = Array(this.height).fill().map(() => Array(this.width).fill(-Infinity));
    }

    clear() {
        for (let y = 0; y < this.height; y++) {
            for (let x = 0; x < this.width; x++) {
                this.screen[y][x] = ' ';
                this.zBuffer[y][x] = -Infinity;
            }
        }
    }

    project(point, scale = 20) {
        const [x, y, z] = point;
        const centerX = this.width / 2;
        const centerY = this.height / 2;
        
        // Add a vertical offset to move the shape up slightly
        const verticalOffset = -this.height * 0.1; // Adjust this value to move up/down
        
        return [
            Math.round(x * scale * this.zoom + centerX),
            Math.round(y * scale * this.zoom + centerY + verticalOffset),
            z * this.zoom
        ];
    }

    rotate(point) {
        let [x, y, z] = point;
        
        const cosX = Math.cos(this.angleX);
        const sinX = Math.sin(this.angleX);
        let newY = y * cosX - z * sinX;
        let newZ = y * sinX + z * cosX;
        y = newY;
        z = newZ;
        
        const cosY = Math.cos(this.angleY);
        const sinY = Math.sin(this.angleY);
        let newX = x * cosY + z * sinY;
        newZ = -x * sinY + z * cosY;
        x = newX;
        z = newZ;
        
        const cosZ = Math.cos(this.angleZ);
        const sinZ = Math.sin(this.angleZ);
        newX = x * cosZ - y * sinZ;
        newY = x * sinZ + y * cosZ;
        x = newX;
        y = newY;
        
        return [x, y, z];
    }

    calculateShading(normal, lightDir = [0.5, -0.5, 1]) {
        const mag = Math.sqrt(normal[0]**2 + normal[1]**2 + normal[2]**2);
        const normalizedNormal = normal.map(n => n/mag);
        const lightMag = Math.sqrt(lightDir[0]**2 + lightDir[1]**2 + lightDir[2]**2);
        const normalizedLight = lightDir.map(l => l/lightMag);
        
        const dot = normalizedNormal.reduce((sum, n, i) => sum + n * normalizedLight[i], 0);
        return Math.max(0, dot);
    }

    drawPoint(x, y, z, char, normal) {
        if (x >= 0 && x < this.width && y >= 0 && y < this.height) {
            if (z > this.zBuffer[y][x]) {
                const shading = this.calculateShading(normal);
                const shadeIndex = Math.floor(shading * (this.shadeChars.length - 1));
                this.screen[y][x] = char || this.shadeChars[shadeIndex];
                this.zBuffer[y][x] = z;
            }
        }
    }

    drawLine(x1, y1, z1, x2, y2, z2, char, normal) {
        const dx = Math.abs(x2 - x1);
        const dy = Math.abs(y2 - y1);
        const sx = x1 < x2 ? 1 : -1;
        const sy = y1 < y2 ? 1 : -1;
        let err = dx - dy;

        let currentX = x1;
        let currentY = y1;
        let currentZ = z1;
        const zStep = (z2 - z1) / (Math.max(dx, dy) || 1);

        while (true) {
            this.drawPoint(currentX, currentY, currentZ, char, normal);

            if (currentX === x2 && currentY === y2) break;
            const e2 = 2 * err;
            if (e2 > -dy) {
                err -= dy;
                currentX += sx;
            }
            if (e2 < dx) {
                err += dx;
                currentY += sy;
            }
            currentZ += zStep;
        }
    }

    createCube(size = 3) {  
        const scaledSize = size * this.zoom;
        const faces = [
            {
                points: [
                    [-scaledSize/2, -scaledSize/2, scaledSize/2],
                    [scaledSize/2, -scaledSize/2, scaledSize/2],
                    [scaledSize/2, scaledSize/2, scaledSize/2],
                    [-scaledSize/2, scaledSize/2, scaledSize/2]
                ],
                normal: [0, 0, 1],
                char: '█',
                fill: true,
                texture: '█'
            },
            {
                points: [
                    [-scaledSize/2, -scaledSize/2, -scaledSize/2],
                    [scaledSize/2, -scaledSize/2, -scaledSize/2],
                    [scaledSize/2, scaledSize/2, -scaledSize/2],
                    [-scaledSize/2, scaledSize/2, -scaledSize/2]
                ],
                normal: [0, 0, -1],
                char: '▓',
                fill: true,
                texture: '▓'
            },
            {
                points: [
                    [scaledSize/2, -scaledSize/2, -scaledSize/2],
                    [scaledSize/2, -scaledSize/2, scaledSize/2],
                    [scaledSize/2, scaledSize/2, scaledSize/2],
                    [scaledSize/2, scaledSize/2, -scaledSize/2]
                ],
                normal: [1, 0, 0],
                char: '▒',
                fill: true,
                texture: '▒'
            },
            {
                points: [
                    [-scaledSize/2, -scaledSize/2, -scaledSize/2],
                    [-scaledSize/2, -scaledSize/2, scaledSize/2],
                    [-scaledSize/2, scaledSize/2, scaledSize/2],
                    [-scaledSize/2, scaledSize/2, -scaledSize/2]
                ],
                normal: [-1, 0, 0],
                char: '░',
                fill: true,
                texture: '░'
            },
            {
                points: [
                    [-scaledSize/2, scaledSize/2, -scaledSize/2],
                    [scaledSize/2, scaledSize/2, -scaledSize/2],
                    [scaledSize/2, scaledSize/2, scaledSize/2],
                    [-scaledSize/2, scaledSize/2, scaledSize/2]
                ],
                normal: [0, 1, 0],
                char: '▓',
                fill: true,
                texture: '▓'
            },
            {
                points: [
                    [-scaledSize/2, -scaledSize/2, -scaledSize/2],
                    [scaledSize/2, -scaledSize/2, -scaledSize/2],
                    [scaledSize/2, -scaledSize/2, scaledSize/2],
                    [-scaledSize/2, -scaledSize/2, scaledSize/2]
                ],
                normal: [0, -1, 0],
                char: '░',
                fill: true,
                texture: '░'
            }
        ];

        this.clear();
        faces.forEach(face => {
            const rotatedPoints = face.points.map(point => this.rotate(point));
            const projectedPoints = rotatedPoints.map(point => this.project(point));
            
            if (face.fill) {
                this.fillFace(projectedPoints, face.normal, face.texture);
            }
            
            for (let i = 0; i < projectedPoints.length; i++) {
                const [x1, y1, z1] = projectedPoints[i];
                const [x2, y2, z2] = projectedPoints[(i + 1) % projectedPoints.length];
                this.drawLine(x1, y1, z1, x2, y2, z2, '█', face.normal);
            }
        });
    }

    fillFace(points, normal, texture) {
        let minX = Math.floor(Math.min(...points.map(p => p[0])));
        let maxX = Math.ceil(Math.max(...points.map(p => p[0])));
        let minY = Math.floor(Math.min(...points.map(p => p[1])));
        let maxY = Math.ceil(Math.max(...points.map(p => p[1])));

        for (let y = minY; y <= maxY; y++) {
            for (let x = minX; x <= maxX; x++) {
                if (this.pointInPolygon([x, y], points)) {
                    const z = this.interpolateZ([x, y], points);
                    this.drawPoint(x, y, z, texture, normal);
                }
            }
        }
    }

    pointInPolygon(point, vertices) {
        const [x, y] = point;
        let inside = false;
        
        for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
            const [xi, yi] = vertices[i];
            const [xj, yj] = vertices[j];
            
            const intersect = ((yi > y) !== (yj > y))
                && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            
            if (intersect) inside = !inside;
        }
        
        return inside;
    }

    interpolateZ(point, vertices) {
        return vertices.reduce((sum, v) => sum + v[2], 0) / vertices.length;
    }

    createSphere(radius = 3, resolution = 2) {
        const scaledRadius = radius * this.zoom;
        this.clear();
        
        // Create a sphere using concentric circles
        for (let phi = -90; phi <= 90; phi += resolution) {
            const ringRadius = scaledRadius * Math.cos(phi * Math.PI / 180);
            const y = scaledRadius * Math.sin(phi * Math.PI / 180);
            
            // Calculate points around this circle
            for (let theta = 0; theta < 360; theta += resolution) {
                const x = ringRadius * Math.cos(theta * Math.PI / 180);
                const z = ringRadius * Math.sin(theta * Math.PI / 180);
                
                const point = [x, y, z];
                const normal = [x/scaledRadius, y/scaledRadius, z/scaledRadius];
                
                // Rotate the point and normal
                const rotatedPoint = this.rotate(point);
                const rotatedNormal = this.rotate(normal);
                
                // Project the point
                const [projX, projY, projZ] = this.project(rotatedPoint);
                
                // Calculate lighting
                let lighting = this.calculateShading(rotatedNormal);
                
                // Enhance edges
                const edgeFactor = Math.abs(rotatedNormal[2]);
                lighting = lighting * 0.8 + edgeFactor * 0.2;
                
                // Add slight variation based on position
                const variation = (Math.sin(phi * 3) * Math.cos(theta * 3)) * 0.1;
                lighting = Math.max(0, Math.min(1, lighting + variation));
                
                // Get appropriate character
                const charIndex = Math.floor(lighting * (this.sphereChars.length - 1));
                const char = this.sphereChars[charIndex];
                
                // Draw the point
                if (projX >= 0 && projX < this.width && projY >= 0 && projY < this.height) {
                    if (projZ > this.zBuffer[projY][projX]) {
                        this.screen[projY][projX] = char;
                        this.zBuffer[projY][projX] = projZ;
                    }
                }
            }
        }
        
        // Add a second pass for more detail
        for (let phi = -90; phi <= 90; phi += resolution * 2) {
            const ringRadius = scaledRadius * Math.cos((phi + resolution) * Math.PI / 180);
            const y = scaledRadius * Math.sin((phi + resolution) * Math.PI / 180);
            
            for (let theta = 0; theta < 360; theta += resolution * 2) {
                const x = ringRadius * Math.cos((theta + resolution) * Math.PI / 180);
                const z = ringRadius * Math.sin((theta + resolution) * Math.PI / 180);
                
                const point = [x, y, z];
                const normal = [x/scaledRadius, y/scaledRadius, z/scaledRadius];
                
                const rotatedPoint = this.rotate(point);
                const rotatedNormal = this.rotate(normal);
                const [projX, projY, projZ] = this.project(rotatedPoint);
                
                // Enhanced lighting for detail pass
                let lighting = this.calculateShading(rotatedNormal);
                lighting = lighting * 0.9 + Math.abs(rotatedNormal[2]) * 0.1;
                
                const charIndex = Math.floor(lighting * (this.sphereChars.length - 1));
                const char = this.sphereChars[charIndex];
                
                // Only draw if it improves detail
                if (projX >= 0 && projX < this.width && projY >= 0 && projY < this.height) {
                    const currentChar = this.screen[projY][projX];
                    const currentIndex = this.sphereChars.indexOf(currentChar);
                    
                    // Draw if current position is empty or new char provides better detail
                    if (currentChar === ' ' || (Math.abs(charIndex - currentIndex) <= 2 && projZ > this.zBuffer[projY][projX])) {
                        this.screen[projY][projX] = char;
                        this.zBuffer[projY][projX] = projZ;
                    }
                }
            }
        }
    }

    createTorus(majorRadius = 3, minorRadius = 1.5, resolution = 5) {  
        const scaledMajorRadius = majorRadius * this.zoom;
        const scaledMinorRadius = minorRadius * this.zoom;
        this.clear();
        
        // Generate points on the torus surface with higher resolution
        for (let u = 0; u < 360; u += resolution) {
            for (let v = 0; v < 360; v += resolution) {
                const uRad = (u * Math.PI) / 180;
                const vRad = (v * Math.PI) / 180;
                
                // Calculate point on torus
                const x = (scaledMajorRadius + scaledMinorRadius * Math.cos(vRad)) * Math.cos(uRad);
                const y = (scaledMajorRadius + scaledMinorRadius * Math.cos(vRad)) * Math.sin(uRad);
                const z = scaledMinorRadius * Math.sin(vRad);
                
                // Calculate normal at this point
                const nx = Math.cos(uRad) * Math.cos(vRad);
                const ny = Math.sin(uRad) * Math.cos(vRad);
                const nz = Math.sin(vRad);
                const normal = [nx, ny, nz];
                
                // Rotate and project the point
                const rotated = this.rotate([x, y, z]);
                const [projX, projY, projZ] = this.project(rotated);
                
                // Calculate shading with enhanced contrast
                const rotatedNormal = this.rotate(normal);
                const shading = Math.pow(this.calculateShading(rotatedNormal), 1.2); // Enhanced contrast
                
                const charIndex = Math.floor(shading * (this.sphereChars.length - 1));
                this.drawPoint(projX, projY, projZ, this.sphereChars[charIndex], rotatedNormal);
            }
        }
    }

    createHelix(radius = 2, height = 4, turns = 3, resolution = 5) {
        const scaledRadius = radius * this.zoom;
        const scaledHeight = height * this.zoom;
        this.clear();
        
        // Generate points along the helix
        for (let t = 0; t <= 360 * turns; t += resolution) {
            const angle = (t * Math.PI) / 180;
            const progress = t / (360 * turns);
            
            // Calculate main helix points
            const x = scaledRadius * Math.cos(angle);
            const y = scaledHeight * (progress - 0.5); // Center vertically
            const z = scaledRadius * Math.sin(angle);
            
            // Calculate normal pointing outward from center
            const nx = Math.cos(angle);
            const ny = 0.2; // Slight vertical normal component
            const nz = Math.sin(angle);
            const normal = [nx, ny, nz];
            
            // Draw main helix line
            const rotated = this.rotate([x, y, z]);
            const [projX, projY, projZ] = this.project(rotated);
            
            const rotatedNormal = this.rotate(normal);
            const shading = Math.pow(this.calculateShading(rotatedNormal), 1.2);
            
            const charIndex = Math.floor(shading * (this.sphereChars.length - 1));
            this.drawPoint(projX, projY, projZ, this.sphereChars[charIndex], rotatedNormal);
            
            // Draw secondary points around main line for thickness
            for (let r = 0; r < 360; r += 60) { // Reduced points for thinner line
                const rRad = (r * Math.PI) / 180;
                const thickness = 0.3 * this.zoom; // Reduced thickness
                const dx = thickness * Math.cos(rRad);
                const dz = thickness * Math.sin(rRad);
                
                const px = x + dx * Math.cos(angle) - dz * Math.sin(angle);
                const pz = z + dx * Math.sin(angle) + dz * Math.cos(angle);
                
                const rotatedThick = this.rotate([px, y, pz]);
                const [projThickX, projThickY, projThickZ] = this.project(rotatedThick);
                
                this.drawPoint(projThickX, projThickY, projThickZ, this.sphereChars[charIndex], rotatedNormal);
            }
        }
    }

    createOctahedron(size = 2) {
        const scaledSize = size * this.zoom;
        this.clear();
        
        // Define vertices
        const vertices = [
            [0, scaledSize, 0],    // top
            [0, -scaledSize, 0],   // bottom
            [scaledSize, 0, 0],    // right
            [-scaledSize, 0, 0],   // left
            [0, 0, scaledSize],    // front
            [0, 0, -scaledSize]    // back
        ];
        
        // Define faces (groups of 3 vertices)
        const faces = [
            [0, 2, 4], [0, 4, 3], [0, 3, 5], [0, 5, 2], // top faces
            [1, 4, 2], [1, 3, 4], [1, 5, 3], [1, 2, 5]  // bottom faces
        ];
        
        // Draw edges first for better definition
        const edges = [
            [0, 2], [0, 3], [0, 4], [0, 5], // top edges
            [1, 2], [1, 3], [1, 4], [1, 5], // bottom edges
        ];
        
        // Draw edges with thicker lines
        for (const [v1, v2] of edges) {
            const start = vertices[v1];
            const end = vertices[v2];
            const steps = 20;
            
            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const x = start[0] * (1 - t) + end[0] * t;
                const y = start[1] * (1 - t) + end[1] * t;
                const z = start[2] * (1 - t) + end[2] * t;
                
                // Add some thickness to edges
                for (let dx = -0.1; dx <= 0.1; dx += 0.1) {
                    for (let dy = -0.1; dy <= 0.1; dy += 0.1) {
                        const rotated = this.rotate([x + dx, y + dy, z]);
                        const [projX, projY, projZ] = this.project(rotated);
                        this.drawPoint(projX, projY, projZ, '@', [x, y, z]);
                    }
                }
            }
        }
        
        // Draw faces with subtle shading
        for (const face of faces) {
            const points = face.map(i => vertices[i]);
            
            // Calculate face normal
            const [a, b, c] = points;
            const v1 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
            const v2 = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
            const normal = [
                v1[1] * v2[2] - v1[2] * v2[1],
                v1[2] * v2[0] - v1[0] * v2[2],
                v1[0] * v2[1] - v1[1] * v2[0]
            ];
            
            // Draw face with sparser points for a cleaner look
            for (let t = 0; t <= 1; t += 0.1) {
                for (let s = 0; s <= 1 - t; s += 0.1) {
                    const r = 1 - t - s;
                    const x = points[0][0] * t + points[1][0] * s + points[2][0] * r;
                    const y = points[0][1] * t + points[1][1] * s + points[2][1] * r;
                    const z = points[0][2] * t + points[1][2] * s + points[2][2] * r;
                    
                    const rotated = this.rotate([x, y, z]);
                    const [projX, projY, projZ] = this.project(rotated);
                    
                    const rotatedNormal = this.rotate(normal);
                    const shading = Math.pow(this.calculateShading(rotatedNormal), 1.5); // More contrast
                    
                    // Use lighter characters for faces
                    const charIndex = Math.floor(shading * (this.sphereChars.length - 1) * 0.7);
                    this.drawPoint(projX, projY, projZ, this.sphereChars[charIndex], rotatedNormal);
                }
            }
        }
    }

    createBear(baseSize = 2) {
        const s = baseSize * this.zoom;
        this.clear();
        
        // Head (larger sphere)
        const drawSphereSection = (centerX, centerY, centerZ, radius, detail = 0.1) => {
            for (let phi = 0; phi < Math.PI; phi += detail) {
                for (let theta = 0; theta < 2 * Math.PI; theta += detail) {
                    const x = centerX + radius * Math.sin(phi) * Math.cos(theta);
                    const y = centerY + radius * Math.sin(phi) * Math.sin(theta);
                    const z = centerZ + radius * Math.cos(phi);
                    
                    const nx = Math.sin(phi) * Math.cos(theta);
                    const ny = Math.sin(phi) * Math.sin(theta);
                    const nz = Math.cos(phi);
                    
                    const rotated = this.rotate([x, y, z]);
                    const [projX, projY, projZ] = this.project(rotated);
                    
                    const rotatedNormal = this.rotate([nx, ny, nz]);
                    const shading = Math.pow(this.calculateShading(rotatedNormal), 1.2);
                    
                    const charIndex = Math.floor(shading * (this.sphereChars.length - 1));
                    this.drawPoint(projX, projY, projZ, this.sphereChars[charIndex], rotatedNormal);
                }
            }
        };

        // Body parts with different sizes
        const parts = [
            // Head
            { x: 0, y: -s*0.5, z: 0, radius: s*1.2, detail: 0.1 },
            // Snout
            { x: 0, y: -s*0.5, z: s*0.8, radius: s*0.6, detail: 0.15 },
            // Left ear
            { x: -s*0.8, y: -s*1.3, z: 0, radius: s*0.4, detail: 0.2 },
            // Right ear
            { x: s*0.8, y: -s*1.3, z: 0, radius: s*0.4, detail: 0.2 },
            // Body
            { x: 0, y: s*0.8, z: 0, radius: s*1.4, detail: 0.1 },
            // Left arm
            { x: -s*1.2, y: s*0.5, z: 0, radius: s*0.5, detail: 0.15 },
            // Right arm
            { x: s*1.2, y: s*0.5, z: 0, radius: s*0.5, detail: 0.15 },
            // Left leg
            { x: -s*0.6, y: s*2.0, z: 0, radius: s*0.5, detail: 0.15 },
            // Right leg
            { x: s*0.6, y: s*2.0, z: 0, radius: s*0.5, detail: 0.15 }
        ];

        // Draw all parts
        parts.forEach(part => {
            drawSphereSection(part.x, part.y, part.z, part.radius, part.detail);
        });

        // Eyes (small dark circles)
        const eyes = [
            { x: -s*0.4, y: -s*0.7, z: s*0.9 },
            { x: s*0.4, y: -s*0.7, z: s*0.9 }
        ];

        eyes.forEach(eye => {
            const rotated = this.rotate([eye.x, eye.y, eye.z]);
            const [projX, projY, projZ] = this.project(rotated);
            this.drawPoint(projX, projY, projZ, '@', [0, 0, 1]);
            
            // Add shine to eyes
            const shine = this.rotate([eye.x + 0.1, eye.y - 0.1, eye.z + 0.1]);
            const [shineX, shineY, shineZ] = this.project(shine);
            this.drawPoint(shineX, shineY, shineZ, '°', [0, 0, 1]);
        });

        // Nose (small dark circle)
        const nose = this.rotate([0, -s*0.5, s*1.5]);
        const [noseX, noseY, noseZ] = this.project(nose);
        this.drawPoint(noseX, noseY, noseZ, '@', [0, 0, 1]);
    }

    update() {
        this.clear();
        switch(this.currentShape) {
            case 'cube':
                this.createCube();
                break;
            case 'sphere':
                this.createSphere();
                break;
            case 'torus':
                this.createTorus();
                break;
            case 'helix':
                this.createHelix();
                break;
            case 'octahedron':
                this.createOctahedron();
                break;
            case 'bear':
                this.createBear();
                break;
        }
        
        document.getElementById('canvas').textContent = this.screen.map(row => row.join('')).join('\n');
    }

    handleMouseDown(e) {
        this.isDragging = true;
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        document.body.style.cursor = 'grabbing';
    }
    
    handleMouseMove(e) {
        if (!this.isDragging) return;
        
        const deltaX = e.clientX - this.lastMouseX;
        const deltaY = e.clientY - this.lastMouseY;
        
        // Update rotation angles based on mouse movement
        this.angleY += deltaX * this.mouseSensitivity;
        this.angleX += deltaY * this.mouseSensitivity;
        
        // Update last mouse position
        this.lastMouseX = e.clientX;
        this.lastMouseY = e.clientY;
        
        // Update display
        this.update();
    }
    
    handleMouseUp() {
        this.isDragging = false;
        document.body.style.cursor = 'default';
    }
    
    handleWheel(e) {
        e.preventDefault();
        
        // Update zoom based on wheel direction
        const delta = -Math.sign(e.deltaY) * this.zoomSensitivity * this.zoom;
        this.zoom = Math.max(0.1, Math.min(3.0, this.zoom + delta * 10));
        
        // Update display
        this.update();
    }
}

// Initialize the shape
const shape = new Shape3D();

// Toggle between shapes
function toggleShape() {
    const shapes = ['cube', 'sphere', 'torus', 'helix', 'octahedron', 'bear'];
    const currentIndex = shapes.indexOf(shape.currentShape);
    shape.currentShape = shapes[(currentIndex + 1) % shapes.length];
    shape.update();
}

// Reset all controls
function resetControls() {
    shape.angleX = 0;
    shape.angleY = 0;
    shape.angleZ = 0;
    shape.zoom = 1.0;
    shape.update();
}

// Initial render
shape.update();
