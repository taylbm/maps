import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { Box, useThemeUI, Text, Flex } from 'theme-ui'
import { Dimmer, Meta } from '@carbonplan/components'
import { Map, Raster, Fill, Line, RegionPicker } from '@carbonplan/maps'
import { useThemedColormap } from '@carbonplan/colormaps'
import RegionControls from '../components/region-controls'
import ParameterControls from '../components/parameter-controls'
import LoginForm from '../components/LoginForm'
import { useRouter } from 'next/router'

const bucket = 'https://carbonplan-maps.s3.us-west-2.amazonaws.com/'

// Helper function to ensure times are in 10-minute increments
const roundToTenMinutes = (date) => {
  const newDate = new Date(date.getTime());
  const minutes = newDate.getUTCMinutes();
  const roundedMinutes = Math.floor(minutes / 10) * 10;
  newDate.setUTCMinutes(roundedMinutes, 0, 0);
  return newDate;
};

// Helper to generate source URL from date parts
const generateSourceURL = (year, month, day, hour, minute) => {
  const datePath = `${year}/${month}/${day}`;
  const hourPath = `${hour}`;
  const fileName = `${year}${month}${day}_${hour}${minute}Z.zarrpyramid`;
  return `https://tmrwwxappspuma.blob.core.windows.net/prod-chimp-inference-viz/GOES_EAST_FD/${datePath}/${hourPath}/${fileName}`;
};

// Helper to parse date from URL parameter
const parseDateParam = (param) => {
  try {
    if (!param) return null;
    const date = new Date(param);
    if (isNaN(date.getTime())) {
      console.warn(`Invalid date format: ${param}`);
      return null;
    }
    return date;
  } catch (error) {
    console.warn("Error parsing date parameter:", error, param);
    return null;
  }
};

// ColorBar component for displaying legends
const ColorBar = ({ colormap, clim, label, units, type = 'linear', sx = {} }) => {
  const { theme } = useThemeUI()
  
  const formatValue = (value) => {
    if (Math.abs(value) < 0.1) return value.toFixed(2);
    if (Math.abs(value) < 1) return value.toFixed(1);
    return Math.round(value);
  }
  
  const getColorScheme = () => {
    const schemes = {
      "TMS Included": {
        type: "sequential",
        colors: ["#6e40aa", "#4c6edb", "#23abd8", "#1ddfa3", "#52f667", "#aff05b", "#e2b72f", "#ff7847", "#fe4b83", "#be3caf"]
      },
      "TMS Denied": {
        type: "sequential", 
        colors: ["#6e40aa", "#4c6edb", "#23abd8", "#1ddfa3", "#52f667", "#aff05b", "#e2b72f", "#ff7847", "#fe4b83", "#be3caf"]
      },
      "TMS Difference": {
        type: "diverging",
        colors: ["#0571b0", "#f7f7f7", "#ca0020"]
      }
    };
    
    return schemes[label] || schemes["TMS Included"];
  };
  
  const scheme = getColorScheme();
  
  const getGradientStyle = () => {
    const { colors } = scheme;
    const stops = colors.map((color, i) => {
      const percent = Math.round((i / (colors.length - 1)) * 100);
      return `${color} ${percent}%`;
    }).join(', ');
    
    return `linear-gradient(to right, ${stops})`;
  };
  
  return (
    <Box 
      sx={{ 
        position: 'absolute',
        bottom: [60, 60, 80, 80],
        left: 20,
        bg: 'background',
        p: 2,
        borderRadius: 'small',
        minWidth: '180px',
        border: '1px solid',
        borderColor: 'muted',
        fontSize: [0, 0, 1, 1],
        zIndex: 1000,
        opacity: 0.9,
        ...sx
      }}
    >
      <Text sx={{ fontWeight: 'bold', mb: 1, color: 'primary' }}>{label}</Text>
      
      <Flex sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
        <Text>{formatValue(clim[0])}</Text>
        <Text sx={{ textAlign: 'center' }}>{units}</Text>
        <Text>{formatValue(clim[1])}</Text>
      </Flex>
      
      <Box sx={{ 
        width: '100%', 
        height: '16px', 
        position: 'relative',
        borderRadius: '2px',
        overflow: 'hidden'
      }}>
        <Box sx={{
          background: getGradientStyle(),
          width: '100%',
          height: '100%',
        }} />
      </Box>
    </Box>
  )
}

const SideBySide = () => {
  const { theme } = useThemeUI()
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [display, setDisplay] = useState(true)
  const [debug, setDebug] = useState(false)
  const [opacity, setOpacity] = useState(1)
  const [clim, setClim] = useState([-1, 1])
  const [month, setMonth] = useState(1)
  const [band, setBand] = useState(1)
  const [colormapName, setColormapName] = useState('rainbow')
  const colormap = useThemedColormap(colormapName)
  const swathColormap = useThemedColormap('wind')
  const divergingColormap = useThemedColormap('redteal')
  const [showRegionPicker, setShowRegionPicker] = useState(false)
  const [regionData, setRegionData] = useState({ loading: true })
  
  // Date and Time state
  const [year, setYear] = useState('2025')
  const [dateMonth, setDateMonth] = useState('05')
  const [day, setDay] = useState('12')
  const [hour, setHour] = useState('16')
  const [minute, setMinute] = useState('40')

  // Animation state
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [animationBaseDate, setAnimationBaseDate] = useState(null)
  const [animationEndDate, setAnimationEndDate] = useState(null)
  const animationTimeoutRef = useRef(null)
  const [totalFrames, setTotalFrames] = useState(72)
  const [animationSpeed, setAnimationSpeed] = useState(500)
  
  // Add state for tracking data loading and errors
  const [dataError, setDataError] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  
  // New state for preloaded frames
  const [preloadedFrames, setPreloadedFrames] = useState([]);
  const [preloadProgress, setPreloadProgress] = useState(0);
  const [preloadComplete, setPreloadComplete] = useState(false);
  const [isPreloadingAll, setIsPreloadingAll] = useState(false);
  
  // Track frames with errors
  const errorFramesRef = useRef(new Set())

  // Parse URL parameters on initial load
  useEffect(() => {
    if (!router || !router.isReady) return;
    
    const { start, end } = router.query;
    
    if (start || end) {
      const startDate = parseDateParam(start);
      const endDate = parseDateParam(end);
      
      const defaultBaseDate = new Date();
      defaultBaseDate.setUTCHours(defaultBaseDate.getUTCHours() - 14);
      roundToTenMinutes(defaultBaseDate);
      
      const defaultEndDate = new Date(defaultBaseDate);
      defaultEndDate.setUTCMinutes(defaultEndDate.getUTCMinutes() + 110);
      
      const finalStartDate = startDate || defaultBaseDate;
      const finalEndDate = endDate || (startDate ? new Date(new Date(startDate).setUTCMinutes(startDate.getUTCMinutes() + 110)) : defaultEndDate);
      
      const minutesDiff = Math.max(1, Math.round((finalEndDate - finalStartDate) / (10 * 60 * 1000)));
      setTotalFrames(minutesDiff + 1);
      
      setAnimationBaseDate(finalStartDate);
      setAnimationEndDate(finalEndDate);
      
      setYear(String(finalStartDate.getUTCFullYear()));
      setDateMonth(String(finalStartDate.getUTCMonth() + 1).padStart(2, '0'));
      setDay(String(finalStartDate.getUTCDate()).padStart(2, '0'));
      setHour(String(finalStartDate.getUTCHours()).padStart(2, '0'));
      setMinute(String(finalStartDate.getUTCMinutes()).padStart(2, '0'));
    }
  }, [router?.isReady, router?.query]);
  
  // Method to preload all frames at once
  const preloadAllFrames = useCallback(async () => {
    if (!animationBaseDate || isPreloadingAll) return;
    
    setIsPreloadingAll(true);
    setPreloadProgress(0);
    
    const frames = [];
    const errors = new Set();
    
    const framePromises = Array.from({ length: totalFrames }, async (_, frameIndex) => {
      const frameDate = new Date(animationBaseDate);
      frameDate.setUTCMinutes(frameDate.getUTCMinutes() + frameIndex * 10);
      
      const frameYear = String(frameDate.getUTCFullYear());
      const frameMonth = String(frameDate.getUTCMonth() + 1).padStart(2, '0');
      const frameDay = String(frameDate.getUTCDate()).padStart(2, '0');
      const frameHour = String(frameDate.getUTCHours()).padStart(2, '0');
      const frameMinute = String(frameDate.getUTCMinutes()).padStart(2, '0');
      
      const frameURL = generateSourceURL(frameYear, frameMonth, frameDay, frameHour, frameMinute);
      
      try {
        const response = await fetch(frameURL + "/.zmetadata", { method: 'HEAD' });
        
        if (!response.ok) {
          throw new Error(`Data not available for frame ${frameIndex}`);
        }
        
        return {
          index: frameIndex,
          url: frameURL,
          year: frameYear,
          month: frameMonth,
          day: frameDay,
          hour: frameHour,
          minute: frameMinute
        };
      } catch (error) {
        console.warn(`Error loading frame ${frameIndex}:`, error);
        errors.add(frameIndex);
        return null;
      }
    });
    
    const chunkSize = 3;
    for (let i = 0; i < totalFrames; i += chunkSize) {
      const chunk = framePromises.slice(i, i + chunkSize);
      const results = await Promise.all(chunk);
      
      results.filter(Boolean).forEach(frame => {
        frames[frame.index] = frame;
      });
      
      setPreloadProgress(Math.min(100, Math.round(((i + chunk.length) / totalFrames) * 100)));
    }
    
    errorFramesRef.current = errors;
    
    const validFrames = frames.filter(Boolean);
    setPreloadedFrames(validFrames);
    setPreloadComplete(true);
    setIsPreloadingAll(false);
    
    if (validFrames.length > 0) {
      const firstFrame = validFrames.find(f => f.index === 0) || validFrames[0];
      setYear(firstFrame.year);
      setDateMonth(firstFrame.month);
      setDay(firstFrame.day);
      setHour(firstFrame.hour);
      setMinute(firstFrame.minute);
      setCurrentFrame(firstFrame.index);
    }
  }, [animationBaseDate, totalFrames, isPreloadingAll]);

  // Effect to preload all frames when animation base date is set
  useEffect(() => {
    if (animationBaseDate && !preloadComplete && !isPreloadingAll) {
      preloadAllFrames();
    }
  }, [animationBaseDate, preloadAllFrames, preloadComplete, isPreloadingAll]);

  // Effect for animation
  useEffect(() => {
    if (isPlaying && preloadComplete && preloadedFrames.length > 0) {
      animationTimeoutRef.current = setTimeout(() => {
        let nextFrameIndex = (currentFrame + 1) % totalFrames;
        let attempts = 0;
        
        while (!preloadedFrames.some(f => f.index === nextFrameIndex) && attempts < totalFrames) {
          nextFrameIndex = (nextFrameIndex + 1) % totalFrames;
          attempts++;
        }
        
        if (attempts >= totalFrames) {
          console.warn("No valid frames found. Stopping animation.");
          setIsPlaying(false);
          return;
        }
        
        setCurrentFrame(nextFrameIndex);
        
      }, animationSpeed);
    } else {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    }
    
    return () => {
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    };
  }, [isPlaying, currentFrame, animationSpeed, preloadComplete, preloadedFrames, totalFrames]);
  
  // Automatically start animation after page load
  useEffect(() => {
    if (isAuthenticated && !animationBaseDate && router.isReady && !router.query.start && !router.query.end) {
      const baseDate = new Date();
      baseDate.setUTCHours(baseDate.getUTCHours() - 14);
      
      const minutes = baseDate.getUTCMinutes();
      const roundedMinutes = Math.floor(minutes / 10) * 10;
      baseDate.setUTCMinutes(roundedMinutes, 0, 0);
      
      setYear(String(baseDate.getUTCFullYear()));
      setDateMonth(String(baseDate.getUTCMonth() + 1).padStart(2, '0'));
      setDay(String(baseDate.getUTCDate()).padStart(2, '0'));
      setHour(String(baseDate.getUTCHours()).padStart(2, '0'));
      setMinute(String(baseDate.getUTCMinutes()).padStart(2, '0'));
      
      const timer = setTimeout(() => {
        setAnimationBaseDate(baseDate);
        setCurrentFrame(0);
      }, 1000);
      
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, animationBaseDate, router.isReady, router.query.start, router.query.end]);

  // Start playing once preloading is complete
  useEffect(() => {
    if (preloadComplete && !isPlaying && preloadedFrames.length > 0) {
      setIsPlaying(true);
    }
  }, [preloadComplete, isPlaying, preloadedFrames]);

  const handleLogin = (enteredPassword) => {
    if (enteredPassword === 'chimp') { 
      setIsAuthenticated(true)
    }
  }

  // Function to reset animation
  const resetAnimation = () => {
    if (isPlaying) {
      setIsPlaying(false);
      setCurrentFrame(0);
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    }
  };

  const handleMinuteChange = (newMinute) => {
    setMinute(newMinute);
  };

  const getters = { 
    display, debug, opacity, clim, month, band, colormapName, 
    year, dateMonth, day, hour, minute, isPlaying, currentFrame, 
    animationSpeed,
  }
  const setters = {
    setDisplay,
    setDebug,
    setOpacity,
    setClim,
    setMonth,
    setBand,
    setColormapName,
    setYear,
    setDateMonth,
    setDay,
    setHour,
    setMinute: handleMinuteChange,
    setIsPlaying,
    setCurrentFrame,
    setAnimationBaseDate,
    resetAnimation,
    setAnimationSpeed,
  }

  // Render LoginForm if not authenticated
  if (!isAuthenticated) {
    return <LoginForm onLogin={handleLogin} />
  }

  // Render side-by-side maps if authenticated
  return (
    <>
      <Meta
        card={'https://images.carbonplan.org/social/maps-demo.png'}
        description={
          'Side-by-side comparison of TMS Included vs TMS Denied precipitation data.'
        }
        title={'CHIMP TMS Data - Side by Side Comparison'}
      />
      <Box sx={{ position: 'absolute', top: 0, bottom: 0, width: '100%' }}>
        <Flex sx={{ height: '100%' }}>
          {/* Left Map - TMS Included */}
          <Box sx={{ width: '50%', position: 'relative', borderRight: '2px solid', borderColor: 'muted' }}>
            <Box sx={{ 
              position: 'absolute', 
              top: 10, 
              left: 10, 
              bg: 'background', 
              color: 'primary', 
              p: 2, 
              borderRadius: 'small',
              zIndex: 1000,
              fontWeight: 'bold'
            }}>
              TMS Included
            </Box>
            <Map zoom={4} center={[-60, -30]} debug={debug}>
              <Fill
                color={'#0000FF80'}
                source={bucket + 'basemaps/ocean'}
                variable={'ocean'}
              />
              <Line
                color={theme.rawColors.primary}
                source={bucket + 'basemaps/land'}
                variable={'land'}
              />
              
              {/* Render TMS Included for all frames but only show the current one */}
              {preloadedFrames.map((frame) => (
                <Raster
                  key={`${frame.url}-included`}
                  colormap={colormap}
                  fillValue={-9999}
                  clim={[0, 10]}
                  display={display && currentFrame === frame.index}
                  opacity={opacity * 0.75}
                  mode={'texture'}
                  source={frame.url}
                  variable={'precip_rate'}
                  selector={{ tms_denial_flag: [0] }}
                  regionOptions={{ setData: currentFrame === frame.index ? setRegionData : null }}
                />
              ))}
              
              {/* Render TMS swath for all frames but only show the current one */}
              {preloadedFrames.map((frame) => (
                <Raster
                  key={`${frame.url}-swath`}
                  colormap={swathColormap}
                  fillValue={-9999}
                  clim={[0, 0.5]}
                  display={display && currentFrame === frame.index}
                  opacity={0.40}
                  mode={'texture'}
                  source={frame.url}
                  variable={'tms_swath'}
                  selector={{ tms_denial_flag: [0] }}
                  regionOptions={{ setData: currentFrame === frame.index ? setRegionData : null }}
                  zindex={2}
                />
              ))}
            </Map>
            
            <ColorBar 
              colormap={colormap} 
              clim={[0, 10]} 
              label="TMS Included"
              units="mm/hr"
            />
          </Box>
          
          {/* Right Map - TMS Denied */}
          <Box sx={{ width: '50%', position: 'relative' }}>
            <Box sx={{ 
              position: 'absolute', 
              top: 10, 
              left: 10, 
              bg: 'background', 
              color: 'primary', 
              p: 2, 
              borderRadius: 'small',
              zIndex: 1000,
              fontWeight: 'bold'
            }}>
              TMS Difference
            </Box>
            <Map zoom={4} center={[-60, -30]} debug={debug}>
              <Fill
                color={'#0000FF80'}
                source={bucket + 'basemaps/ocean'}
                variable={'ocean'}
              />
              <Line
                color={theme.rawColors.primary}
                source={bucket + 'basemaps/land'}
                variable={'land'}
              />
              
              {/* Render TMS Difference for all frames but only show the current one */}
              {preloadedFrames.map((frame) => (
                <Raster
                  key={`${frame.url}-difference`}
                  colormap={divergingColormap}
                  fillValue={-9999}
                  clim={clim}
                  display={display && currentFrame === frame.index}
                  opacity={0.75}
                  mode={'texture'}
                  source={frame.url}
                  variable={'precip_rate'}
                  selector={{ tms_denial_flag: [0, 1] }}
                  regionOptions={{ setData: currentFrame === frame.index ? setRegionData : null }}
                  frag = {`
                    // compute signed difference
                    float diff = tms_denial_flag_0 - tms_denial_flag_1;
                  
                    // pick symmetric bounds around zero
                    float maxAbs = max(abs(clim.x), abs(clim.y));
                    float low  = -maxAbs;
                    float high =  maxAbs;

                    // normalize diff into [0,1], so that diff==low → 0.0, diff==0 → 0.5, diff==high → 1.0
                    float t = (diff - low) / (high - low);
                  
                    // sample a diverging colormap texture (e.g. reds ↔ blues)
                    vec4 c = texture2D(colormap, vec2(t, 1.0));
                  
                    // output with opacity and premultiplied alpha
                    gl_FragColor = vec4(c.rgb, opacity);
                    gl_FragColor.rgb *= gl_FragColor.a;
                  `}
                />
              ))}
            </Map>
            
            <ColorBar 
              colormap={divergingColormap} 
              clim={clim} 
              label="TMS Difference"
              units="mm/hr"
              type="diverging"
            />
          </Box>
        </Flex>
        
        {/* Preloading progress indicator */}
        {isPreloadingAll && (
          <Box 
            sx={{ 
              position: 'absolute', 
              top: '50%', 
              left: '50%', 
              transform: 'translate(-50%, -50%)',
              bg: 'background',
              color: 'text',
              p: 4,
              borderRadius: 'small',
              width: '300px',
              textAlign: 'center',
              zIndex: 1000,
              boxShadow: '0 0 20px rgba(0,0,0,0.2)'
            }}
          >
            <Text sx={{ fontSize: 3, fontWeight: 'bold', mb: 3 }}>
              Preloading Data Frames
            </Text>
            
            <Box sx={{ 
              width: '100%', 
              height: '12px', 
              bg: 'muted', 
              borderRadius: 'small',
              overflow: 'hidden'
            }}>
              <Box sx={{ 
                width: `${preloadProgress}%`, 
                height: '100%', 
                bg: 'primary',
                transition: 'width 0.3s ease-in-out'
              }} />
            </Box>
            
            <Text sx={{ mt: 2 }}>
              {preloadProgress}% Complete
            </Text>
          </Box>
        )}
        
        {/* Frame indicator */}
        {preloadComplete && isPlaying && (
          <Box 
            sx={{ 
              position: 'absolute', 
              bottom: 10, 
              right: 10,
              bg: 'background',
              color: 'text',
              p: 2,
              borderRadius: 'small',
              zIndex: 900,
              opacity: 0.8
            }}
          >
            <Text>
              {(() => {
                const currentFrameObj = preloadedFrames.find(f => f.index === currentFrame);
                return currentFrameObj ? 
                  `Frame ${currentFrame + 1}/${preloadedFrames.length} • ${currentFrameObj.year}-${currentFrameObj.month}-${currentFrameObj.day} ${currentFrameObj.hour}:${currentFrameObj.minute} UTC` :
                  `Frame ${currentFrame + 1}/${preloadedFrames.length}`;
              })()}
            </Text>
          </Box>
        )}
        
        {/* Simplified Parameter Controls for side-by-side view */}
        <Box sx={{ position: 'absolute', top: 20, right: 20 }}>
          <Flex sx={{ flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
            {/* Animation Controls */}
            <Box>
              <Text sx={{ fontFamily: 'mono', letterSpacing: 'mono', textTransform: 'uppercase', fontSize: [1, 1, 1, 2], mb: 2 }}>
                Animation
              </Text>
              <Flex sx={{ gap: 2 }}>
                {!isPlaying ? (
                  <button 
                    onClick={() => setIsPlaying(true)}
                    style={{
                      padding: '8px 16px',
                      fontSize: '14px',
                      backgroundColor: '#FFFF00',
                      color: 'black',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Play
                  </button>
                ) : (
                  <button 
                    onClick={() => setIsPlaying(false)}
                    style={{
                      padding: '8px 16px',
                      fontSize: '14px',
                      backgroundColor: '#FFFF00',
                      color: 'black',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer'
                    }}
                  >
                    Pause
                  </button>
                )}
              </Flex>
            </Box>
          </Flex>
        </Box>
        
        {/* Navigation link back to main view */}
        <Box sx={{ 
          position: 'absolute', 
          top: 20, 
          left: '50%', 
          transform: 'translateX(-50%)',
          zIndex: 1000
        }}>
          <a 
            href="/" 
            style={{
              display: 'inline-block',
              padding: '8px 16px',
              backgroundColor: '#0066CC',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '4px',
              fontSize: '14px',
              fontWeight: 'bold'
            }}
          >
            Back to Main View
          </a>
        </Box>
        
        <Dimmer
          sx={{
            display: ['initial', 'initial', 'initial', 'initial'],
            position: 'absolute',
            color: 'primary',
            right: [13],
            bottom: [17, 17, 15, 15],
          }}
        />
      </Box>
    </>
  )
}

export default SideBySide 