import { Box, Flex, Input, Label, Button, Text } from 'theme-ui'
import { useCallback } from 'react'
import { Slider, Badge, Toggle, Select, Link } from '@carbonplan/components'
import { colormaps } from '@carbonplan/colormaps'

const sx = {
  label: {
    fontFamily: 'mono',
    letterSpacing: 'mono',
    textTransform: 'uppercase',
    fontSize: [1, 1, 1, 2],
    mt: [3],
  },
}

const CLIM_RANGES = {
  tavg: { max: 30, min: -20 },
  prec: { max: 300, min: 0 },
  precip_tms_denied_no: { max: 1, min: -1 },
  precip_tms_denied_yes: { max: 1, min: -1 },
  tms_swath: { max: 0.5, min: 0 },
  '0': { max: 1, min: -1},
  '1': { max: 1, min: -1 },
}

const DEFAULT_COLORMAPS = {
  tavg: 'warm',
  prec: 'cool',
  precip_tms_denied_yes: 'rainbow',
  precip_tms_denied_no: 'rainbow',
  tms_swath: 'wind',
  '0': 'rainbow',
  '1': 'rainbow',
}

const ParameterControls = ({ getters, setters }) => {
  const { 
    display, debug, opacity, clim, month, band, colormapName, 
    showSwath, showTMSDataDenialDifference, showTMSIncluded, showTMSDenied, 
    year, dateMonth, day, hour, minute, isPlaying, 
    viewMode, VIEW_MODES,
    animationSpeed
  } = getters
  const {
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
    setMinute,
    setIsPlaying,
    setCurrentFrame,
    setAnimationBaseDate,
    resetAnimation,
    setAnimationSpeed
  } = setters

  const handlePlay = () => {
    const baseDate = new Date(parseInt(year), parseInt(dateMonth) - 1, parseInt(day), parseInt(hour), parseInt(minute));
    setAnimationBaseDate(baseDate);
    setCurrentFrame(0);
    setIsPlaying(true);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleViewModeChange = (e) => {
    // Reset any ongoing animation first
    resetAnimation();
    
    // Set the new view mode
    setViewMode(e.target.value);
    
    // Create a UTC date object from current time
    const baseDate = new Date();
    
    // Always subtract 14 hours from the current time (changed from 4 hours)
    baseDate.setUTCHours(baseDate.getUTCHours() - 14);
    
    // Round to the nearest 10-minute mark
    const minutes = baseDate.getUTCMinutes();
    const roundedMinutes = Math.floor(minutes / 10) * 10;
    baseDate.setUTCMinutes(roundedMinutes, 0, 0); // Set to 10-minute intervals, seconds and ms to 0
    
    // Add a slight delay to ensure view mode has updated
    setTimeout(() => {
      setAnimationBaseDate(baseDate);
      setCurrentFrame(0);
      setIsPlaying(true);
      
      // Update the displayed date/time to match what's actually being used
      setYear(String(baseDate.getUTCFullYear()));
      setDateMonth(String(baseDate.getUTCMonth() + 1).padStart(2, '0'));
      setDay(String(baseDate.getUTCDate()).padStart(2, '0'));
      setHour(String(baseDate.getUTCHours()).padStart(2, '0'));
      setMinute(String(baseDate.getUTCMinutes()).padStart(2, '0'));
    }, 100);
  };

  const handleBandChange = useCallback((e) => {
    const band = e.target.value
    setBand(parseInt(band))
    setClim([CLIM_RANGES[band].min, CLIM_RANGES[band].max])
    setColormapName(DEFAULT_COLORMAPS[band])
  })

  return (
    <>
      <Box sx={{ position: 'absolute', top: 20, right: 20 }}>
        <Flex
          sx={{
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 4,
          }}
        >
          <Box>
            <Box sx={{ ...sx.label, mt: [0] }}>TMS Swath</Box>
            <Toggle
              sx={{ display: 'block', float: 'right', mt: [2] }}
              value={showSwath}
              onClick={() => {
                resetAnimation();
                setShowSwath((prev) => !prev);
              }}
            />
          </Box>
          
          <Box>
            <Box sx={{ ...sx.label, mt: [0] }}>TMS Data Layer</Box>
            <Select
              sx={{ display: 'block', float: 'right', mt: [2], minWidth: '180px' }}
              value={viewMode}
              onChange={handleViewModeChange}
            >
              <option value={VIEW_MODES.NONE}>None</option>
              <option value={VIEW_MODES.TMS_DIFFERENCE}>TMS Data Denial Difference</option>
              <option value={VIEW_MODES.TMS_INCLUDED}>TMS Included</option>
              <option value={VIEW_MODES.TMS_DENIED}>TMS Denied</option>
            </Select>
          </Box>
        </Flex>
      </Box>
      <Box sx={{ position: 'absolute', top: 20, left: 20 }}> 
        {/* Date/Time Controls */}
        <Box sx={{ ...sx.label, mt: [4] }}>Date & Time (UTC)</Box>
        <Flex sx={{ gap: 2, alignItems: 'center' }}>
          <Box>
            <Label sx={sx.label} htmlFor="year">Year</Label>
            <Input id="year" type="number" value={year} onChange={(e) => setYear(e.target.value)} sx={{width: '70px'}} />
          </Box>
          <Box>
            <Label sx={sx.label} htmlFor="dateMonth">Month</Label>
            <Input id="dateMonth" type="number" value={dateMonth} onChange={(e) => setDateMonth(e.target.value)} sx={{width: '50px'}}/>
          </Box>
          <Box>
            <Label sx={sx.label} htmlFor="day">Day</Label>
            <Input id="day" type="number" value={day} onChange={(e) => setDay(e.target.value)} sx={{width: '50px'}}/>
          </Box>
          <Box>
            <Label sx={sx.label} htmlFor="hour">Hour</Label>
            <Input id="hour" type="number" value={hour} onChange={(e) => setHour(e.target.value)} sx={{width: '50px'}}/>
          </Box>
          <Box>
            <Label sx={sx.label} htmlFor="minute">Minute</Label>
            <Input 
              id="minute" 
              type="number" 
              value={minute}
              onChange={(e) => {
                const newMinute = parseInt(e.target.value);
                // Round to nearest 10-minute interval
                const roundedMinute = Math.floor(newMinute / 10) * 10;
                setMinute(String(roundedMinute).padStart(2, '0'));
              }}
              min="0"
              max="50"
              step="10"
              sx={{
                width: '50px'
              }}
            />
          </Box>
        </Flex>

        {/* Animation Controls */}
        <Box sx={{ ...sx.label, mt: [4] }}>Animation</Box>
        <Flex sx={{ gap: 2, flexDirection: 'column' }}>
          <Flex sx={{ gap: 2 }}>
            {!isPlaying ? (
              <Button 
                onClick={handlePlay} 
                sx={{
                  py: 2, px: 3, fontSize: 2,
                  bg: '#FFFF00', // Bright yellow
                  color: 'black',
                  '&:hover': { bg: '#FFD700' } // Darker yellow hover
                }}
              >
                Play
              </Button>
            ) : (
              <Button 
                onClick={handlePause} 
                sx={{
                  py: 2, px: 3, fontSize: 2,
                  bg: '#FFFF00', // Bright yellow
                  color: 'black',
                  '&:hover': { bg: '#FFD700' } // Darker yellow hover
                }}
              >
                Pause
              </Button>
            )}
          </Flex>
          
          {/* Animation Speed Slider */}
          <Box sx={{ mt: 2 }}>
            <Box sx={{ ...sx.label, fontSize: [0, 0, 0, 1], mt: [1] }}>Speed (ms between frames)</Box>
            <Flex sx={{ alignItems: 'center' }}>
              <Slider
                min={100}
                max={3000}
                step={100}
                sx={{ width: '175px', display: 'inline-block' }}
                value={animationSpeed}
                onChange={(e) => setAnimationSpeed(parseInt(e.target.value))}
              />
              <Badge
                sx={{
                  bg: 'primary',
                  color: 'background',
                  display: 'inline-block',
                  fontSize: [1, 1, 1, 2],
                  height: ['21px', '21px', '21px', '23px'],
                  position: 'relative',
                  left: [3],
                  top: ['3px'],
                }}
              >
                {animationSpeed}
              </Badge>
            </Flex>
            <Flex sx={{ justifyContent: 'space-between', fontSize: 0, color: 'secondary', mt: 1 }}>
              <Text>Fast</Text>
              <Text>Slow</Text>
            </Flex>
          </Box>
        </Flex>
      </Box>
    </>
  )
}

export default ParameterControls
