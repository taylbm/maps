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

// Define view mode constants
const VIEW_MODES = {
  NONE: 'none', // No additional layer beyond swath (if enabled)
  TMS_DIFFERENCE: 'tms_difference',
  TMS_INCLUDED: 'tms_included',
  TMS_DENIED: 'tms_denied'
};

// Helper function to ensure times are in hour increments
const roundToHourStart = (date) => {
  const newDate = new Date(date.getTime());
  newDate.setUTCMinutes(0, 0, 0); // Set minutes, seconds and ms to 0
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
    
    // Expected formats: 
    // 1. YYYY-MM-DDThh:mm:ssZ (ISO)
    // 2. YYYY-MM-DD (Date only)
    
    // 1. Construct your date (from a timestamp, ISO string, etc.)
    const date = new Date(param);

    
    if (isNaN(date.getTime())) {
      console.warn(`Invalid date format: ${param}`);
      return null;
    }
    
    // Return without rounding as requested
    return date;
  } catch (error) {
    console.warn("Error parsing date parameter:", error, param);
    return null;
  }
};

// ColorBar component for displaying legends
const ColorBar = ({ colormap, clim, label, units, type = 'linear', sx = {} }) => {
  const { theme } = useThemeUI()
  
  // Convert a numeric value to a label with appropriate precision
  const formatValue = (value) => {
    if (Math.abs(value) < 0.1) return value.toFixed(2);
    if (Math.abs(value) < 1) return value.toFixed(1);
    return Math.round(value);
  }
  
  // Use specific hardcoded color schemes based on label
  const getColorScheme = () => {
    // Default schemes
    const schemes = {
      "TMS Data Denial Difference": {
        type: "diverging",
        colors: ["#0571b0", "#f7f7f7", "#ca0020"]
      },
      "TMS Included": {
        type: "sequential",
        colors: ["#6e40aa", "#4c6edb", "#23abd8", "#1ddfa3", "#52f667", "#aff05b", "#e2b72f", "#ff7847", "#fe4b83", "#be3caf"]
      },
      "TMS Denied": {
        type: "sequential", 
        colors: ["#6e40aa", "#4c6edb", "#23abd8", "#1ddfa3", "#52f667", "#aff05b", "#e2b72f", "#ff7847", "#fe4b83", "#be3caf"]
      }
    };
    
    // Return the color scheme
    return schemes[label] || 
      (type === "diverging" 
        ? schemes["TMS Data Denial Difference"] 
        : schemes["TMS Included"]);
  };
  
  const scheme = getColorScheme();
  
  // For TMS Included and Denied, we want to reverse the rainbow gradient
  if (label === "TMS Included" || label === "TMS Denied") {
    scheme.colors = ["#6e40aa", "#4c6edb", "#23abd8", "#1ddfa3", "#52f667", "#aff05b", "#e2b72f", "#ff7847", "#fe4b83", "#be3caf"];
  }
  
  // Create CSS gradient style based on color scheme
  const getGradientStyle = () => {
    const { colors } = scheme;
    
    if (scheme.type === "diverging") {
      return `linear-gradient(to right, ${colors[0]}, ${colors[1]}, ${colors[2]})`;
    } else {
      // For sequential, create stops at even intervals
      const stops = colors.map((color, i) => {
        const percent = Math.round((i / (colors.length - 1)) * 100);
        return `${color} ${percent}%`;
      }).join(', ');
      
      return `linear-gradient(to right, ${stops})`;
    }
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
        
        {/* Center line for diverging colormaps */}
        {scheme.type === 'diverging' && (
          <Box sx={{
            position: 'absolute',
            top: 0,
            left: '50%',
            transform: 'translateX(-50%)',
            width: '1px',
            height: '100%',
            bg: 'text',
            opacity: 0.5
          }} />
        )}
      </Box>
      
      {/* Add zero label for diverging colormaps */}
      {scheme.type === 'diverging' && (
        <Text sx={{ 
          position: 'absolute', 
          bottom: '-4px', 
          left: '50%', 
          transform: 'translateX(-50%)', 
          fontSize: '10px',
          color: 'text'
        }}>
          0
        </Text>
      )}
    </Box>
  )
}

const Index = () => {
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
  
  // Keep the showSwath toggle
  const [showSwath, setShowSwath] = useState(true)
  
  // Replace the other three toggles with a single viewMode state
  const [viewMode, setViewMode] = useState(VIEW_MODES.TMS_DIFFERENCE)
  
  // Computed boolean values based on viewMode
  const showTMSDataDenialDifference = viewMode === VIEW_MODES.TMS_DIFFERENCE
  const showTMSIncluded = viewMode === VIEW_MODES.TMS_INCLUDED
  const showTMSDenied = viewMode === VIEW_MODES.TMS_DENIED
  
  // Date and Time state
  const [year, setYear] = useState('2025')
  const [dateMonth, setDateMonth] = useState('05') // Renamed to avoid conflict with existing 'month' state
  const [day, setDay] = useState('12')
  const [hour, setHour] = useState('16')
  const [minute, setMinute] = useState('40')
  const [source, setSource] = useState('')

  // Animation state
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentFrame, setCurrentFrame] = useState(0)
  const [animationBaseDate, setAnimationBaseDate] = useState(null)
  const [animationEndDate, setAnimationEndDate] = useState(null)
  const animationTimeoutRef = useRef(null)
  const [totalFrames, setTotalFrames] = useState(72); // Default 72 frames for 12 hours at 10-minute intervals
  const [animationSpeed, setAnimationSpeed] = useState(1500) // Default: 1500ms between frames
  
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
  const lastSourceRef = useRef(''); // Track last successful source to avoid redundant fetches

  // State for color bar positioning
  const [colorBarOffset, setColorBarOffset] = useState(0)
  
  // Parse URL parameters on initial load
  useEffect(() => {
    if (!router || !router.isReady) return;
    
    // Get start and end parameters from URL
    const { start, end } = router.query;
    
    if (start || end) {
      // Parse the dates from URL parameters
      const startDate = parseDateParam(start);
      const endDate = parseDateParam(end);
      
      console.log("URL Parameters - Start:", startDate, "End:", endDate);
      
      // Calculate default if either is missing
      const defaultBaseDate = new Date();
      defaultBaseDate.setUTCHours(defaultBaseDate.getUTCHours() - 14);
      roundToHourStart(defaultBaseDate);
      
      const defaultEndDate = new Date(defaultBaseDate);
      defaultEndDate.setUTCMinutes(defaultEndDate.getUTCMinutes() + 110); // +110 minutes = 12 frames total (10-minute intervals)
      
      // Use custom dates if valid, otherwise use defaults
      const finalStartDate = startDate || defaultBaseDate;
      const finalEndDate = endDate || (startDate ? new Date(new Date(startDate).setUTCMinutes(startDate.getUTCMinutes() + 110)) : defaultEndDate);
      
      // Calculate number of frames (10-minute intervals) between start and end
      const minutesDiff = Math.max(1, Math.round((finalEndDate - finalStartDate) / (10 * 60 * 1000))); // 10-minute intervals
      setTotalFrames(minutesDiff + 1); // +1 to include the end time
      
      // Set animation dates
      setAnimationBaseDate(finalStartDate);
      setAnimationEndDate(finalEndDate);
      
      // Update initial display date/time
      setYear(String(finalStartDate.getUTCFullYear()));
      setDateMonth(String(finalStartDate.getUTCMonth() + 1).padStart(2, '0'));
      setDay(String(finalStartDate.getUTCDate()).padStart(2, '0'));
      setHour(String(finalStartDate.getUTCHours()).padStart(2, '0'));
      setMinute(String(finalStartDate.getUTCMinutes()).padStart(2, '0'));
    }
  }, [router?.isReady, router?.query]);
  
  // Optimize source generation through memoization
  const currentSourceURL = useMemo(() => {
    // Ensure values are padded to two digits
    const paddedMonth = String(dateMonth).padStart(2, '0');
    const paddedDay = String(day).padStart(2, '0');
    const paddedHour = String(hour).padStart(2, '0');
    const paddedMinute = String(minute).padStart(2, '0');
    
    return generateSourceURL(year, paddedMonth, paddedDay, paddedHour, paddedMinute);
  }, [year, dateMonth, day, hour, minute]);

  // Method to preload all frames at once
  const preloadAllFrames = useCallback(async () => {
    if (!animationBaseDate || isPreloadingAll) return;
    
    setIsPreloadingAll(true);
    setPreloadProgress(0);
    
    const frames = [];
    const errors = new Set();
    
    // Create an array of promises for all frame checks
    const framePromises = Array.from({ length: totalFrames }, async (_, frameIndex) => {
      // Calculate the date for this frame (10-minute intervals)
      const frameDate = new Date(animationBaseDate);
      frameDate.setUTCMinutes(frameDate.getUTCMinutes() + frameIndex * 10);
      
      // Generate URL for this frame
      const frameYear = String(frameDate.getUTCFullYear());
      const frameMonth = String(frameDate.getUTCMonth() + 1).padStart(2, '0');
      const frameDay = String(frameDate.getUTCDate()).padStart(2, '0');
      const frameHour = String(frameDate.getUTCHours()).padStart(2, '0');
      const frameMinute = String(frameDate.getUTCMinutes()).padStart(2, '0');
      
      const frameURL = generateSourceURL(frameYear, frameMonth, frameDay, frameHour, frameMinute);
      
      try {
        // Check if data exists at this URL
        const response = await fetch(frameURL + "/.zmetadata", { method: 'HEAD' });
        
        if (!response.ok) {
          throw new Error(`Data not available for frame ${frameIndex}`);
        }
        
        // Return frame data
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
        // Return null for failed frames
        return null;
      }
    });
    
    // Process frames in chunks to update progress
    const chunkSize = 3;
    for (let i = 0; i < totalFrames; i += chunkSize) {
      const chunk = framePromises.slice(i, i + chunkSize);
      const results = await Promise.all(chunk);
      
      // Filter out null results and add valid frames
      results.filter(Boolean).forEach(frame => {
        frames[frame.index] = frame;
      });
      
      // Update progress
      setPreloadProgress(Math.min(100, Math.round(((i + chunk.length) / totalFrames) * 100)));
    }
    
    // Store errors in ref
    errorFramesRef.current = errors;
    
    // Filter out any null frames from the array
    const validFrames = frames.filter(Boolean);
    setPreloadedFrames(validFrames);
    setPreloadComplete(true);
    setIsPreloadingAll(false);
    
    // Set initial source if we have at least one valid frame
    if (validFrames.length > 0) {
      const firstFrame = validFrames.find(f => f.index === 0) || validFrames[0];
      setYear(firstFrame.year);
      setDateMonth(firstFrame.month);
      setDay(firstFrame.day);
      setHour(firstFrame.hour);
      setMinute(firstFrame.minute);
      setSource(firstFrame.url);
      setCurrentFrame(firstFrame.index);
    }
  }, [animationBaseDate, totalFrames, isPreloadingAll]);

  // Effect to preload all frames when animation base date is set
  useEffect(() => {
    if (animationBaseDate && !preloadComplete && !isPreloadingAll) {
      preloadAllFrames();
    }
  }, [animationBaseDate, preloadAllFrames, preloadComplete, isPreloadingAll]);

  // Effect for animation with frame visibility toggling
  useEffect(() => {
    if (isPlaying && preloadComplete && preloadedFrames.length > 0) {
      animationTimeoutRef.current = setTimeout(() => {
        // Find next valid frame
        let nextFrameIndex = (currentFrame + 1) % totalFrames;
        let attempts = 0;
        
        // Skip frames with errors
        while (!preloadedFrames.some(f => f.index === nextFrameIndex) && attempts < totalFrames) {
          nextFrameIndex = (nextFrameIndex + 1) % totalFrames;
          attempts++;
        }
        
        // If we couldn't find a valid next frame, stop animation
        if (attempts >= totalFrames) {
          console.warn("No valid frames found. Stopping animation.");
          setIsPlaying(false);
          return;
        }
        
        // Just update current frame - our render logic will handle showing the right frame
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
  
  // Automatically start animation after page load (and authentication) if URL params aren't provided
  useEffect(() => {
    if (isAuthenticated && !animationBaseDate && router.isReady && !router.query.start && !router.query.end) {
      // Start from 14 hours ago in UTC
      const baseDate = new Date();
      baseDate.setUTCHours(baseDate.getUTCHours() - 14);
      
      // Round to the nearest 10-minute mark
      const minutes = baseDate.getUTCMinutes();
      const roundedMinutes = Math.floor(minutes / 10) * 10;
      baseDate.setUTCMinutes(roundedMinutes, 0, 0); // Set to 10-minute intervals, seconds and ms to 0
      
      // Update all the date/time states based on the new base date using UTC
      setYear(String(baseDate.getUTCFullYear()));
      setDateMonth(String(baseDate.getUTCMonth() + 1).padStart(2, '0'));
      setDay(String(baseDate.getUTCDate()).padStart(2, '0'));
      setHour(String(baseDate.getUTCHours()).padStart(2, '0'));
      setMinute(String(baseDate.getUTCMinutes()).padStart(2, '0'));
      
      // Small delay to ensure everything is properly loaded and states have updated
      const timer = setTimeout(() => {
        setAnimationBaseDate(baseDate);
        setCurrentFrame(0);
        // Don't immediately start playing - wait for preloading
      }, 1000); // 1 second delay
      
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
    // Hardcoded password for demo purposes. Use environment variables or a proper auth system in production.
    if (enteredPassword === 'chimp') { 
      setIsAuthenticated(true)
    }
  }

  // Function to reset animation when toggle controls are flipped
  const resetAnimation = () => {
    if (isPlaying) {
      setIsPlaying(false);
      setCurrentFrame(0);
      if (animationTimeoutRef.current) {
        clearTimeout(animationTimeoutRef.current);
      }
    }
  };

  // Handle date/time input changes to ensure 10-minute increments
  const handleMinuteChange = (newMinute) => {
    // The minute select dropdown only has 10-minute increment options,
    // so we don't need additional validation here
    setMinute(newMinute);
  };

  const getters = { 
    display, debug, opacity, clim, month, band, colormapName, 
    showSwath, 
    showTMSDataDenialDifference, showTMSIncluded, showTMSDenied, 
    year, dateMonth, day, hour, minute, isPlaying, currentFrame, 
    viewMode, VIEW_MODES, 
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
    setShowSwath,
    setViewMode,
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

  // Render map if authenticated
  return (
    <>
      <Meta
        card={'https://images.carbonplan.org/social/maps-demo.png'}
        description={
          'Demo of our library for making interactive multi-dimensional data-driven web maps.'
        }
        title={'CHIMP TMS Data Denial'}
      />
      <Box sx={{ position: 'absolute', top: 0, bottom: 0, width: '100%' }}>
        <Map zoom={2} center={[-100, 0]} debug={debug}>
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
          {showRegionPicker && (
            <RegionPicker
              color={theme.colors.primary}
              backgroundColor={theme.colors.background}
              fontFamily={theme.fonts.mono}
              fontSize={'14px'}
              maxRadius={2000}
            />
          )}
          
          {/* Render all preloaded frames but only show the current one */}
          {preloadedFrames.map((frame) => (
            showTMSDataDenialDifference && (
              <Raster
                key={`${frame.url}-diff`}
                colormap={divergingColormap}
                clim={clim}
                display={display && currentFrame === frame.index}
                opacity={0.75}
                fillValue={-9999}
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
                zindex={showTMSDataDenialDifference ? 1 : 0}
              />
            )
          ))}
          
          {/* Render swath for all frames but only show the current one */}
          {preloadedFrames.map((frame) => (
            showSwath && (
              <Raster
                key={`${frame.url}-swath`}
                colormap={swathColormap}
                fillValue={-9999}
                clim={[0, 0.5]}
                display={display && showSwath && currentFrame === frame.index}
                opacity={0.40}
                mode={'texture'}
                source={frame.url}
                variable={'tms_swath'}
                selector={{ tms_denial_flag: [0] }}
                regionOptions={{ setData: currentFrame === frame.index ? setRegionData : null }}
                zindex={showTMSDataDenialDifference ? 2 : 1}
              />
            )
          ))}
          
          {/* Render TMS Denied for all frames but only show the current one */}
          {preloadedFrames.map((frame) => (
            showTMSDenied && (
              <Raster
                key={`${frame.url}-denied`}
                colormap={colormap}
                fillValue={-9999}
                clim={[0, 10]}
                display={display && showTMSDenied && currentFrame === frame.index}
                opacity={opacity * 0.75}
                mode={'texture'}
                source={frame.url}
                variable={'precip_rate'}
                selector={{ tms_denial_flag: [1] }}
                regionOptions={{ setData: currentFrame === frame.index ? setRegionData : null }}
              />
            )
          ))}
          
          {/* Render TMS Included for all frames but only show the current one */}
          {preloadedFrames.map((frame) => (
            showTMSIncluded && (
              <Raster
                key={`${frame.url}-included`}
                colormap={colormap}
                fillValue={-9999}
                clim={[0, 10]}
                display={display && showTMSIncluded && currentFrame === frame.index}
                opacity={opacity * 0.75}
                mode={'texture'}
                source={frame.url}
                variable={'precip_rate'}
                selector={{ tms_denial_flag: [0] }}
                regionOptions={{ setData: currentFrame === frame.index ? setRegionData : null }}
              />
            )
          ))}
          
          <RegionControls
            band={band}
            regionData={regionData}
            showRegionPicker={showRegionPicker}
            setShowRegionPicker={setShowRegionPicker}
          />
        </Map>
        
        {/* Color bars */}
        {preloadComplete && showTMSDataDenialDifference && (
          <ColorBar 
            colormap={divergingColormap} 
            clim={clim} 
            label="TMS Data Denial Difference"
            units="mm/hr"
            type="diverging"
          />
        )}
        
        {preloadComplete && showTMSIncluded && (
          <ColorBar 
            colormap={colormap} 
            clim={[0, 10]} 
            label="TMS Included"
            units="mm/hr"
            sx={{ bottom: showTMSDataDenialDifference ? 160 : 80 }}
          />
        )}
        
        {preloadComplete && showTMSDenied && (
          <ColorBar 
            colormap={colormap} 
            clim={[0, 10]} 
            label="TMS Denied"
            units="mm/hr"
            sx={{ 
              bottom: (() => {
                if (showTMSDataDenialDifference && showTMSIncluded) return 240;
                if (showTMSDataDenialDifference || showTMSIncluded) return 160;
                return 80;
              })()
            }}
          />
        )}
        
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
            
            {/* Progress bar */}
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
            <Text sx={{ mt: 2, fontSize: 1, opacity: 0.8 }}>
              This will enable smoother animation playback
            </Text>
          </Box>
        )}
        
        {/* Error message for missing data */}
        {dataError && (
          <Box 
            sx={{ 
              position: 'absolute', 
              top: '50%', 
              left: '50%', 
              transform: 'translate(-50%, -50%)',
              bg: 'rgba(0,0,0,0.7)',
              color: 'white',
              p: 3,
              borderRadius: 'small',
              maxWidth: '80%',
              textAlign: 'center',
              zIndex: 1000
            }}
          >
            <Text sx={{ fontSize: 3, fontWeight: 'bold' }}>
              Data not available for {year}-{dateMonth}-{day} {hour}:{minute} UTC
            </Text>
            <Text sx={{ mt: 2 }}>
              {isPlaying ? 'Skipping to next frame...' : 'Please try another time.'}
            </Text>
          </Box>
        )}
        
        {/* Loading indicator with UTC indication */}
        {isLoading && !isPreloadingAll && (
          <Box 
            sx={{ 
              position: 'absolute', 
              top: 10, 
              right: 10,
              bg: 'primary',
              color: 'background',
              p: 2,
              borderRadius: 'small',
              zIndex: 1000
            }}
          >
            <Text>Loading data for {hour}:{minute} UTC...</Text>
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
        
        <ParameterControls getters={getters} setters={setters} />
        
        {/* Navigation link to side-by-side view */}
        <Box sx={{ 
          position: 'absolute', 
          top: 20, 
          left: '50%', 
          transform: 'translateX(-50%)',
          zIndex: 1000
        }}>
          <a 
            href="/side-by-side" 
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
            View Side-by-Side Comparison
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

export default Index
