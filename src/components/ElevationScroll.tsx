import useScrollTrigger from '@mui/material/useScrollTrigger';
import React, { ReactElement } from 'react';

/**
 * Component that changes the elevation of a child component when scrolled.
 */
const ElevationScroll = ({ children, elevate = false, alwaysTransparent = false }: { children: ReactElement, elevate?: boolean, alwaysTransparent?: boolean }) => {
    const trigger = useScrollTrigger({
        disableHysteresis: true,
        threshold: 0
    });

    const isElevated = elevate || trigger;

    return React.cloneElement(children, {
        color: isElevated && !alwaysTransparent ? 'default' : 'transparent',
        elevation: isElevated && !alwaysTransparent ? 4 : 0
    });
};

export default ElevationScroll;
