/* FRI VIND / shared hulls and human skeleton. SI metres/kilograms.
 * Laser dimensions follow ILCA7 proportions; all hydrodynamic coefficients,
 * mass distributions, medium dinghy, 40-foot yacht and AC75 are GAME values.
 * Dinghies use unballasted daggerboards. The yacht has a separate ballast
 * mass and displacement; the foiler has two moving foil assembly masses.
 * The conventional boats share an articulated sailor model with scaled mass.
 * AC75 has eight seated 90kg crew+gear stations. Physics and graphics share
 * the actual poses; no weight-shift torque is added on top of those masses.
 */
(function(install){
 if(typeof module!=='undefined'&&module.exports)module.exports=install;
 else install(globalThis);
})(function(root){
 'use strict';
 const D=Math.PI/180,clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t;
 const COMMON={kind:'dinghy',crewMass:75,gravity:9.81,airDensity:1.225,waterDensity:1025,
  sailLiftSlope:5.25,sailCLMax:1.22,sailProfileCD:.038,sailInducedCD:.13,sailPlateCD:1.26,stallStart:18*D,stallEnd:33*D,
  foilLiftSlope:4.1,foilCLMax:1.10,foilInducedCD:.085,
  boomMin:7*D,boomMax:86*D,sheetRate:.27,rudderMax:28*D,rudderRate:1.7,
  // These are independently tunable game controls: target sensitivity,
  // held-key growth and mechanical actuator speed do not change inertia.
  helmInitialFraction:.18,helmGrowthSeconds:.50,helmSpeedReference:4.8,helmMinimumFraction:.55,rudderCenterRate:1.8,
  // Crew commands are immediate, but mass follows the articulated body's
  // bounded-speed, bounded-acceleration transfer. Units are pose units/s,
  // side-blend units/s and their squared-time derivatives, not force bonuses.
  crewPoseRate:.65,crewPoseAcceleration:1.50,crewPoseResponse:.23,
  crewPoseReturnRate:1.10,crewPoseReturnAcceleration:3.20,crewPoseReturnResponse:.16,
  crewSideRate:.80,crewSideAcceleration:1.80,crewSideResponse:.26,
  crewHikingInset:.055,crewHikingLean:1.12,
  capsizeAngle:74*D,
  vang:.55,cunningham:.35,outhaul:.65,baseTwist:7*D,camber:.095,
  fixedDt:1/60,seaTimeConstant:1.25,seaWindReference:5,seaBaseFraction:.2,seaWindFraction:.8,seaMaxScale:1.85,
  gybeHysteresis:12*D,gybeTorqueCoefficient:1.7,
  // Added fluid inertia and linear damping are game approximations.
  rollRestoring:0,autoBalanceGain:0,heaveDamping:1300,rollDamping:95,pitchDamping:210,
  hydroNx:18,hydroNz:10,hydroNy:5,mastFloatVolume:.0196,crewFloatVolume:.072,
  rigDragLinear:8,rigDragQuadratic:4,rigRollDamping:230,rigPitchDamping:200,rigYawDamping:150,
  hullHeelDrag:2.5,hullWetRigDrag:8,hullWetRigLateralDrag:2,
  floodFillSeconds:.7,floodDrainSeconds:3.5,
  cockpitRadius:.12,planing:false,helmReverseThreshold:.20,helmForwardThreshold:.26,ironsSpeed:.72,ironsAngle:55*D,ironsYawAcceleration:.10,ironsMaxYawRate:8*D,ironsBackAngle:18*D};
 function make(id,name,description,v){
  const p={...COMMON,id,name,label:name,description,...v};p.hullRigMass=p.hullMass+p.rigMass+p.equipmentMass+(p.ballastMass||0)+2*(p.armMass||0);p.mass=p.hullRigMass+p.crewMass;
  p.hullSections=v.shape.map(([x,w])=>[x*p.length,w*(p.hullBeam||p.beam)*.5]);delete p.shape;
  p.cockpit={minX:p.cockpitMinX,maxX:p.cockpitMaxX,x0:p.cockpitMinX,x1:p.cockpitMaxX,halfWidth:p.cockpitHalfWidth,floorY:p.cockpitFloorY,radius:p.cockpitRadius};
  p.mastHeight=p.mastTop;p.sailFoot=p.boomLength-.06;
  p.crewX=p.crewX??(-.11*p.length);p.crewMax=p.beam*.5+.43;
  p.crewForeAftRange=p.kind==='foiler'?.15:p.length*.065;
  p.massPoints=[...(p.hullOffsets||[0]).map(z=>({mass:p.hullMass/(p.hullOffsets?.length||1),x:p.hullCGX,y:p.hullCGY,z})),{mass:p.rigMass,x:p.mastX-.12,y:p.rigCGY,z:0},{mass:p.equipmentMass,x:-.25,y:p.deckY-.05,z:0}];
  if(p.ballastMass)p.massPoints.push({mass:p.ballastMass,x:p.ballastX,y:p.ballastY,z:0,ballast:true});
  if(p.kind!=='foiler'){
   p.intrinsicInertia={roll:p.rollInertia,pitch:p.pitchInertia,yaw:p.yawInertia};
   for(const m of p.massPoints){p.rollInertia+=m.mass*(m.y*m.y+m.z*m.z);p.pitchInertia+=m.mass*(m.x*m.x+m.y*m.y);p.yawInertia+=m.mass*(m.x*m.x+m.z*m.z);}
  }
  return p;
 }
 const CONFIGS={
  // Calibrated shallow, flat-bottom section (power6) and shell CG inside
  // the hull. These are GAME righting parameters, not measured ILCA data.
  laser:make('laser','Laserjolle','4,23 meter. Let skrog, stort sejl og aktiv balance.',{
   length:4.23,referenceWaterline:3.81,beam:1.37,hullDepth:.385,deckY:.245,rocker:.09,chinePower:6.0,planing:true,planingAreaFraction:.12,planingLiftSlope:1.2,planingMaxWeightFraction:.70,
   crewHikingInset:.11,crewHikingLean:1.05,
   crewPoseRate:4.2,crewPoseAcceleration:30,crewPoseResponse:.10,
   crewPoseReturnRate:4.8,crewPoseReturnAcceleration:38.4,crewPoseReturnResponse:.095,
   crewSideRate:3.55,crewSideAcceleration:17,crewSideResponse:.09,
   helmInitialFraction:.45,helmGrowthSeconds:.27,
   shape:[[-.485,.745],[-.390,.876],[-.248,.972],[-.059,1],[.118,.949],[.272,.745],[.390,.438],[.515,.018]],
   hullMass:56,rigMass:10,equipmentMass:2,hullCGX:-.02,hullCGY:-.035,rigCGY:1.65,
   sailArea:7.06,mastX:1.02,mastTop:6.18,boomY:.98,boomLength:2.73,sailLuff:5.15,sailCPChord:1.04,sailCPHeight:2.66,
   daggerArea:.245,daggerDepth:1.02,daggerChord:.30,daggerX:.05,rudderArea:.075,rudderDepth:.66,rudderChord:.205,rudderX:-1.95,
   yawInertia:182,rollInertia:57,pitchInertia:220,boomInertia:4.8,boomDamping:10,
   sheetCurve:.90,sheetReleaseRate:.85,sheetReleaseKeyRate:1.55,
   hullLinearDrag:2.8,hullQuadraticDrag:2.7,hullWaveDrag:.60,hullWaveRise:{from:.54,to:.70,extra:.40},hullLateralLinear:22,hullCrossflowCD:.82,
   // Passive roll damping gives the sailor time to retract after a warning;
   // the righting curve and capsize angle remain physical, with no immunity.
   yawLinearDamping:27,yawQuadraticDamping:22,rollDamping:260,
   cockpitMinX:-1.25,cockpitMaxX:.32,cockpitHalfWidth:.35,cockpitFloorY:.04,
   flotationVolume:.86,color:'#608b96'}),
  // Fictional 32-foot sport keelboat, inspired by the supplied open-cockpit
  // Melges reference. Dimensions and masses are game calibrations, not class data.
  // The stable 'dinghy' identity is retained for existing multiplayer rooms.
  dinghy:make('dinghy','Racer 32','Let kapsejladsbåd på 9,75 meter med tre sejlere i trapez.',{
   shortName:'Racer 32',kind:'keelboat',racingYacht:true,courseScale:2.55,
   helmInitialFraction:.44,helmGrowthSeconds:.24,
   crewPoseRate:2.75,crewPoseAcceleration:16,crewPoseResponse:.10,
   crewPoseReturnRate:2.3,crewPoseReturnAcceleration:9,crewPoseReturnResponse:.13,
   crewSideRate:1.60,crewSideAcceleration:5.5,crewSideResponse:.18,
   length:9.75,beam:3.10,hullDepth:1.05,deckY:.68,rocker:.18,chinePower:3.0,
   planing:true,planingAreaFraction:.13,planingLiftSlope:1.1,planingMaxWeightFraction:.52,
   planingStrips:[[-.65,.28],[0,.44],[.65,.28]],
   shape:[[-.48,.88],[-.36,.98],[-.17,1],[.04,.95],[.24,.77],[.4,.41],[.515,.012]],
   hullMass:880,rigMass:150,equipmentMass:170,ballastMass:760,crewMass:240,hullCGX:-.08,hullCGY:.10,rigCGY:4.4,
   ballastX:.10,ballastY:-1.65,ballastVolume:.096,keelBottomY:-1.80,keelTopY:-.40,keelChord:1.18,keelArea:1.95,
   sailArea:55,mainArea:35,jibArea:20,mastX:1.20,mastTop:13.6,boomY:1.30,boomLength:4.72,sailLuff:12.1,
   sailCPChord:1.90,sailCPHeight:5.85,mainCPX:-.62,mainCPHeight:5.85,jibCPX:1.65,jibCPHeight:5.15,
   jibTackX:4.55,jibTackY:.77,jibHeadX:1.20,jibHeadY:12.5,jibLuff:12.20,jibFoot:40/12.20,
   daggerArea:1.95,daggerDepth:2.40,daggerCPY:-1.0,daggerChord:1.18,daggerX:.10,rudderArea:.62,rudderDepth:2.00,rudderChord:.44,rudderX:-4.24,rudderOffsets:[-.90,.90],
   yawInertia:17400,rollInertia:1850,pitchInertia:17500,boomInertia:32,boomDamping:90,
   hullLinearDrag:21,hullQuadraticDrag:24,hullWaveDrag:1.65,hullLateralLinear:160,hullLateralQuadratic:305,
   yawLinearDamping:1170,yawQuadraticDamping:1540,heaveDamping:10800,rollDamping:2500,pitchDamping:6600,
   boomMin:4*D,boomMax:83*D,sheetRate:.24,sheetCurve:.82,sheetReleaseRate:.43,sheetReleaseKeyRate:1.05,rudderMax:28*D,rudderRate:1.64,baseTwist:5*D,pressureTwist:34*D,sailCLMax:1.3,foilProfileCD:.008,
   cockpitMinX:-4.24,cockpitMaxX:-.64,cockpitHalfWidth:1.00,cockpitFloorY:.37,cockpitRadius:.16,crewX:-3.25,crewOffsets:[0,1.13,2.26],crewFloatVolume:.216,
   hydroNx:14,hydroNz:8,hydroNy:5,mastFloatVolume:.027,rigDragLinear:17,rigDragQuadratic:11,rigRollDamping:1700,rigPitchDamping:3300,rigYawDamping:1400,capsizeAngle:100*D,
   ironsSpeed:.8,ironsYawAcceleration:.045,ironsMaxYawRate:7*D,flotationVolume:15,color:'#163e66'}),
  yacht:make('yacht','Turbåd 43','Nem og stabil turbåd på 13,1 meter.',{
   helmInitialFraction:.36,helmGrowthSeconds:.39,
   crewPoseRate:1.95,crewPoseAcceleration:6.2,crewPoseResponse:.16,
   crewPoseReturnRate:1.95,crewPoseReturnAcceleration:6.2,crewPoseReturnResponse:.16,
   kind:'keelboat',length:13.1,beam:4.05,hullDepth:1.75,deckY:1.08,rocker:.32,chinePower:2.4,
   shape:[[-.48,.69],[-.37,.91],[-.18,1],[.04,.985],[.22,.86],[.38,.53],[.51,.014]],
   hullMass:5200,rigMass:400,equipmentMass:900,ballastMass:2800,crewMass:300,hullCGX:-.08,hullCGY:.18,rigCGY:6.5,
   ballastX:.25,ballastY:-1.88,ballastVolume:.265,keelBottomY:-2.15,keelTopY:-.50,keelChord:1.65,keelArea:2.90,
   sailArea:80,mainArea:48,jibArea:32,code0Area:90,gennakerArea:105,spinnakerArea:115,mastX:1.5,mastTop:18.2,boomY:2.0,boomLength:5.7,sailLuff:16.0,
   sailCPChord:2.3,runningPressureArm:.28,sailCPHeight:7.8,mainCPX:-.8,mainCPHeight:7.8,jibCPX:1.7,jibCPHeight:6.9,
   jibTackX:5.7,jibTackY:1.13,jibHeadX:1.5,jibHeadY:16.9,jibLuff:16.3,jibFoot:4.0583386176,
   daggerArea:2.90,daggerDepth:3.15,daggerCPY:-1.325,daggerChord:1.65,daggerX:.25,rudderArea:.82,rudderDepth:2.35,rudderChord:.62,rudderX:-5.25,
   yawInertia:76000,rollInertia:4200,pitchInertia:76000,boomInertia:110,boomDamping:280,
   hullLinearDrag:110,hullQuadraticDrag:55,hullWaveDrag:4.8,hullLateralLinear:260,hullLateralQuadratic:600,
   yawLinearDamping:2800,yawQuadraticDamping:3600,heaveDamping:21000,rollDamping:6500,pitchDamping:14000,
   boomMin:5*D,boomMax:83*D,sheetRate:.20,sheetCurve:.78,sheetReleaseKeyRate:.95,rudderMax:26*D,rudderRate:.9,baseTwist:6*D,
   sailProfileCD:.026,sailInducedCD:.10,sailCLMax:1.3,foilProfileCD:.009,
   cockpitMinX:-4.85,cockpitMaxX:-1.25,cockpitHalfWidth:1.02,cockpitFloorY:.69,cockpitRadius:.20,crewX:-4.15,crewOffsets:[0,.75,1.50,2.25],
   hydroNx:14,hydroNz:8,hydroNy:5,mastFloatVolume:.055,rigDragLinear:45,rigDragQuadratic:32,
   rigRollDamping:9000,rigPitchDamping:18000,rigYawDamping:6000,capsizeAngle:104*D,
   hullWetRigDrag:5,hullWetRigLateralDrag:2.2,

   ironsSpeed:.85,ironsYawAcceleration:.022,ironsMaxYawRate:5*D,courseScale:4,
   flotationVolume:23,color:'#244958'}),
  // 2024 AC75-inspired dimensions and mass, NOT a certified class model or
  // measured AC75 polar. All foil polars, drag and actuator gains are game
  // calibrations. The 1265kg assemblies are dynamic masses, not ballast added
  // a second time. Main+jib areas are projected area (twin skin counts once).
  ac75:make('ac75','Foilmonohull','20,7 meter. Automatisk foiltrim; styr kurs og sejl selv.',{
   kind:'foiler',courseScale:8,length:20.7,beam:5,deckY:1.30,hullDepth:2.10,rocker:.70,chinePower:2.2,
   shape:[[-.48,.55],[-.40,.77],[-.28,.94],[-.10,1],[.12,.95],[.30,.68],[.43,.32],[.52,.009]],
   hullMass:2890,rigMass:500,equipmentMass:260,armMass:1265,crewMass:720,waterDensity:1025,
   hullCGX:-.30,hullCGY:.52,rigCGY:9.0,
   sailArea:230,mainArea:165,jibArea:65,mastX:3,mastTop:26.5,boomY:1.35,boomLength:12.86,sailLuff:25,
   sailCPChord:4.85,sailCPHeight:10.0,mainCPX:-1.85,mainCPHeight:10.0,jibCPX:5.4,jibCPHeight:8.5,
   jibTackX:9.3,jibTackY:1.35,jibHeadX:3,jibHeadY:23,jibLuff:21.65,
   heavyAir:{main:.58,jib:.56},
   crewStations:[-3.1,-4.2,-5.3,-6.4].flatMap(x=>[-1,1].map(side=>({x,y:1.65,z:side*1.25,mass:90}))),
   boomMin:1.0*D,boomMax:82*D,sheetRate:.22,sheetCurve:.68,sheetReleaseKeyRate:.90,baseTwist:2.0*D,camber:.065,
   sailLiftSlope:5.6,sailCLMax:1.45,sailProfileCD:.016,sailInducedCD:.065,sailPlateCD:1.2,stallStart:17*D,stallEnd:30*D,
   boomInertia:820,boomDamping:3300,gybeTorqueCoefficient:.7,
   foilHingeX:.55,foilHingeY:.75,foilHingeZ:1.9,foilDrop:3.3,foilOutreach:2.7,foilCant:22*D,
   foilSpan:4.5,foilArea:2.0,foilDownAngle:0,foilUpAngle:1.30,foilArmRate:.30,foilArmAcceleration:.28,
   foilFlapMin:-10*D,foilFlapMax:17*D,foilFlapRate:22*D,foilDifferentialMax:3*D,foilIncidence:0,
   foilLiftSlope:5.6,foilCLMax:1.45,foilAttachedLimit:1.04,foilProfileCD:.0085,foilInducedCD:.038,foilPlateCD:1.20,
   foilStallStart:14*D,foilStallEnd:25*D,foilStrutArea:.95,foilStrutCD:.004,
   foilVentDepth:.16,foilVentLoss:.88,foilVentOnset:.45,foilVentRecovery:2.4,
   rudderX:-9,rudderY:-2.45,rudderSpan:2.8,rudderWingArea:.85,rudderArea:.82,rudderDepth:3.5,rudderChord:.26,
   rudderMax:14*D,waterborneRudderMax:9*D,waterborneSlowRudderMax:13*D,easySlowRudderMax:21*D,rudderRate:105*D,rudderCenterRate:98*D,helmInitialFraction:.28,helmGrowthSeconds:.32,helmSpeedReference:8,helmMinimumFraction:.65,
   rudderFlapMin:-12*D,rudderFlapMax:15*D,rudderFlapRate:25*D,
   daggerArea:0,daggerDepth:0,daggerChord:0,daggerX:.55,
   // Intrinsic body inertia plus the point-mass contributions of rig, crew,
   // and moving arms are added by FoilingPhysics.massProperties.
   rollInertia:12500,pitchInertia:120000,yawInertia:105000,
   heaveDamping:27000,rollDamping:1800,pitchDamping:5000,
   hullLinearDrag:90,hullQuadraticDrag:110,hullWaveDrag:2.0,hullLateralLinear:800,hullLateralQuadratic:1700,
   yawLinearDamping:2500,yawQuadraticDamping:8000,
   hullAirArea:7,hullAirCD:.45,hullSlamCoefficient:2.1,hullSlamTangentialCD:.32,
   cockpitMinX:-7.1,cockpitMaxX:-2.1,cockpitHalfWidth:1.7,cockpitFloorY:1.02,cockpitRadius:.24,
   hydroNx:20,hydroNz:10,hydroNy:5,mastFloatVolume:.8,crewFloatVolume:.70,rigDragLinear:100,rigDragQuadratic:60,
   // v10: coordinated finite-actuator flight crew. The load observer trims
   // steady moments; faster attitude loops leave short disturbances intact.
   flightHeight:.68,flightPitch:1.5*D,pitchKp:3.3,pitchKd:2.6,rollKp:3.8,rollKd:2.8,
   foilTrimLoadTime:.45,flightHeightRateGain:1.2,flightVerticalRateGain:1.65,flightClimbRate:.95,flightDescentRate:.85,
   flightBankGain:.36,flightBankLimit:7*D,flightClimbPitchGain:.012,flightRollAccelLimit:.95,flightPitchAccelLimit:.70,foilStrutVentCoupling:.70,
   helmFlightInitialFraction:.66,helmFlightGrowthSeconds:.14,
   foilOverlapSeconds:6,foilSideHysteresis:8*D,foilSingleLoadFraction:.16,foilKeepLoadFraction:.22,foilSingleConfirmSeconds:4,
   ironsSpeed:1.1,ironsYawAcceleration:.025,ironsMaxYawRate:5*D,
   capsizeAngle:72*D,

   flotationVolume:60,color:'#e5483f'}),
  // AC72-inspired GAME variant. 22x14m / 40m wing height / 260m² are scale
  // references from the AC72 rule. Mass distribution, polars, foil flaps,
  // automatic rake and enhanced stability are deliberately game parameters.
  // The 6,900kg total includes all eleven 90kg crew+gear stations.
  ac72:make('ac72','Foilkatamaran','To skrog, et stift vingesejl og fire bærende foilflader.',{
   kind:'foiler',hullType:'catamaran',rigidWing:true,courseScale:8,length:22,beam:14,hullBeam:1.70,hullOffsets:[-6.15,6.15],deckY:1.65,hullDepth:2.0,rocker:.46,chinePower:2.3,
   shape:[[-.49,.48],[-.40,.77],[-.23,.97],[0,1],[.22,.92],[.39,.63],[.51,.015]],
   hullMass:3260,rigMass:900,equipmentMass:1150,armMass:300,crewMass:990,waterDensity:1025,
   hullCGX:-.15,hullCGY:.58,rigCGY:13.0,
   sailArea:260,mainArea:205,jibArea:55,jibTackX:12.0,jibTackY:1.9,jibHeadX:2.2,jibHeadY:31.5,jibFoot:3.72,mastX:2.2,mastTop:40,boomY:1.8,boomLength:11.12,sailLuff:38.2,
   wingSections:[[0,11.12],[.18,10.55],[.43,8.2],[.68,5.4],[.88,2.6],[1,.9]],wingFlapFraction:.28,wingFlapMax:11*D,wingFlapRate:38*D,
   sailCPChord:3.30,sailCPHeight:15.0,mainCPX:-1.1,mainCPHeight:15.0,jibCPX:4,jibCPHeight:9,
   crewStations:[-2.2,-3.25,-4.3,-5.35,-6.4].flatMap(x=>[-1,1].map(side=>({x,y:1.94,z:side*5.88,mass:90}))).concat([{x:-7.3,y:1.92,z:0,mass:90}]),
   boomMin:.7*D,boomMax:84*D,sheetRate:.24,baseTwist:0,camber:.04,
   sailLiftSlope:7.2,sailCLMax:1.50,sailProfileCD:.012,sailInducedCD:.045,sailPlateCD:1.12,stallStart:19*D,stallEnd:33*D,
   boomInertia:1900,boomDamping:4700,gybeTorqueCoefficient:.55,
   foilHingeX:.8,foilHingeY:1.30,foilHingeZ:6.15,foilDrop:4.5,foilOutreach:0,foilCant:5*D,
   foilSpan:3.20,foilArea:2.4,foilDownAngle:0,foilUpAngle:1,foilRetraction:3.8,foilArmRate:.34,foilArmAcceleration:.44,
   foilFlapMin:-10*D,foilFlapMax:18*D,foilFlapRate:30*D,foilDifferentialMax:3.5*D,foilIncidence:0,
   foilLiftSlope:5.8,foilCLMax:1.50,foilAttachedLimit:1.12,foilProfileCD:.0105,foilInducedCD:.045,foilPlateCD:1.2,
   foilStallStart:15*D,foilStallEnd:27*D,foilStrutArea:.72,foilStrutCD:.003,
   foilVentDepth:.17,foilVentLoss:.84,foilVentOnset:.5,foilVentRecovery:2.5,
   rudderX:-9.5,rudderY:-3.00,rudderSpan:1.75,rudderWingArea:.45,rudderArea:.37,rudderDepth:4.65,rudderChord:.24,
   rudderMax:13*D,waterborneRudderMax:7*D,waterborneSlowRudderMax:11*D,easySlowRudderMax:17*D,rudderRate:100*D,rudderCenterRate:96*D,helmInitialFraction:.27,helmGrowthSeconds:.34,helmSpeedReference:8,helmMinimumFraction:.65,
   rudderFlapMin:-12*D,rudderFlapMax:17*D,rudderFlapRate:32*D,daggerArea:0,daggerDepth:0,daggerChord:0,daggerX:.8,
   rollInertia:24000,pitchInertia:160000,yawInertia:155000,
   heaveDamping:30000,rollDamping:2800,pitchDamping:7000,
   // Totals for BOTH hulls; applied separately at each local water contact.
   hullLinearDrag:100,hullQuadraticDrag:78,hullWaveDrag:.90,hullLateralLinear:850,hullLateralQuadratic:1800,
   yawLinearDamping:3200,yawQuadraticDamping:11000,hullAirArea:9,hullAirCD:.32,hullSlamCoefficient:2.0,hullSlamTangentialCD:.30,
   cockpitMinX:-7.5,cockpitMaxX:-1.7,cockpitHalfWidth:.60,cockpitFloorY:1.08,cockpitRadius:.15,
   hydroNx:20,hydroNz:8,hydroNy:5,mastFloatVolume:2.3,crewFloatVolume:.95,rigDragLinear:140,rigDragQuadratic:85,
   flightHeight:.85,flightPitch:.8*D,pitchKp:3.0,pitchKd:3.2,rollKp:3.2,rollKd:3.4,
   rideControl:{waveFilter:.48,fastHeightReduction:.13,immersionHeightReduction:.36},
   foilTrimLoadTime:.30,flightHeightRateGain:1.2,flightVerticalRateGain:1.8,flightClimbRate:.95,flightDescentRate:.85,
   flightBankGain:.25,flightBankLimit:4*D,flightClimbPitchGain:.012,flightRollAccelLimit:.95,flightPitchAccelLimit:.70,foilStrutVentCoupling:.70,
   helmFlightInitialFraction:.68,helmFlightGrowthSeconds:.14,
   foilOverlapSeconds:5,foilSideHysteresis:8*D,ironsSpeed:1.1,ironsYawAcceleration:.025,ironsMaxYawRate:5*D,
   capsizeAngle:68*D,
   flotationVolume:43,color:'#c92331'})
 };
 // Scale the explicit wing outline once to its stated projected area. Physics
 // and the two-element render mesh use this exact, inspectable table.
 {const p=CONFIGS.ac72,a=p.wingSections,raw=a.slice(1).reduce((sum,v,i)=>sum+(v[0]-a[i][0])*(v[1]+a[i][1])*.5,0)*p.sailLuff,factor=p.mainArea/raw;p.wingSections=a.map(([v,chord])=>[v,chord*factor]);p.boomLength=p.wingSections[0][1];p.sailFoot=p.boomLength;}
 function get(id){if(id&&typeof id==='object'){if(id.hullSections)return id;id=id.boatId||id.id;}return CONFIGS[id]||CONFIGS.laser;}
 function halfBeamAt(model,x){const p=get(model),a=p.hullSections;if(x<a[0][0]||x>a[a.length-1][0])return 0;for(let i=1;i<a.length;i++)if(x<=a[i][0])return mix(a[i-1][1],a[i][1],(x-a[i-1][0])/(a[i][0]-a[i-1][0]));return a[a.length-1][1];}
 function hullBottom(model,x,z){const p=get(model),w=halfBeamAt(p,x);if(w<=0)return p.deckY;const r=clamp(Math.abs(z)/w,0,1),u=x/(p.length*.52),depth=(p.hullDepth-p.rocker*u*u)*(.58+.42*Math.min(1,w/((p.hullBeam||p.beam)*.25)));return p.deckY-depth*(1-Math.pow(r,p.chinePower));}
 // Use the same span limits as the drawn blades and split twin-rudder area.
 for(const p of [CONFIGS.laser,CONFIGS.dinghy,CONFIGS.yacht]){
  p.waterBlades={
   board:{x:p.daggerX,root:p.keelTopY??hullBottom(p,p.daggerX,0),tip:p.keelBottomY??-p.daggerDepth,chord:p.daggerChord,area:p.daggerArea,taper:.78},
   rudder:{x:p.rudderX,root:p.deckY-.10,tip:p.deckY-p.rudderDepth,chord:p.rudderChord,area:p.rudderArea,taper:.82}
  };
 }
 function insideCockpit(model,x,z){const p=get(model),c=p.cockpit,r=c.radius,ax=Math.max(c.minX+r-x,0,x-(c.maxX-r)),az=Math.max(Math.abs(z)-(c.halfWidth-r),0);return ax*ax+az*az<=r*r&&x>=c.minX&&x<=c.maxX&&Math.abs(z)<=c.halfWidth;}
 function point(x,y,z){return {x,y,z};}
 function blendPoint(a,b,t){return point(mix(a.x,b.x,t),mix(a.y,b.y,t),mix(a.z,b.z,t));}
 function midpoint(a,b){return blendPoint(a,b,.5);}
 function jointBetween(a,b,L1,L2,bend={x:0,y:1,z:0}){
  const vx=b.x-a.x,vy=b.y-a.y,vz=b.z-a.z,raw=Math.hypot(vx,vy,vz),d=clamp(raw,1e-5,L1+L2-1e-5),ux=vx/(raw||1),uy=vy/(raw||1),uz=vz/(raw||1);
  const along=(L1*L1-L2*L2+d*d)/(2*d),height=Math.sqrt(Math.max(0,L1*L1-along*along)),dot=bend.x*ux+bend.y*uy+bend.z*uz;
  let nx=bend.x-dot*ux,ny=bend.y-dot*uy,nz=bend.z-dot*uz,nn=Math.hypot(nx,ny,nz);if(nn<1e-5){nx=1-ux*ux;ny=-ux*uy;nz=-ux*uz;nn=Math.hypot(nx,ny,nz)||1;}
  return point(a.x+ux*along+nx/nn*height,a.y+uy*along+ny/nn*height,a.z+uz*along+nz/nn*height);
 }
 function boomDistance(model,angle,p,horizontal=false){
  const fx=-Math.cos(angle),fz=Math.sin(angle),x=p.x-model.mastX;
  const along=clamp(x*fx+p.z*fz,0,model.boomLength);
  return Math.hypot(x-fx*along,p.z-fz*along,horizontal?0:p.y-model.boomY);
 }
 function crewPose(model,degree,side,swim=0,offset=0,single=false,motion=null){
  const p=get(model),d=clamp(degree,1,3),sg=clamp(side,-1,1),k=clamp(swim,0,1);
  const lo=Math.min(1,Math.floor(d-1)),u=d-1-lo,t=u*u*u*(u*(u*6-15)+10);
  const x=p.crewX+offset+(motion?.crewForeAft??0)*p.crewForeAftRange;
  const cruiser=p.id==='yacht';
  const edge=p.kind==='keelboat'?halfBeamAt(p,x):p.beam*.5;
  const trapezeFeet=p.racingYacht?[halfBeamAt(p,x+.27)-.04,halfBeamAt(p,x-.27)-.04]:null;
  // Fixed human segment lengths across all hulls and through the transfer.
  // A two-link solve locates each knee/elbow; feet remain under the strap.
  // The Laser's middle stance sits just inside the coaming with a small lean.
  // Position3 moves to the outer gunwale and extends the upper body; their
  // distinct lever arms are computed from these joints, never a bonus.
  const seat=trapezeFeet?[
   {r:.10,y:p.cockpit.floorY+.25,lean:.03,foot:.12},
   {r:Math.min(edge-.16,p.cockpit.halfWidth+.03),y:p.deckY+.02,lean:.27,foot:.31},
   // Limit the reach by the shorter foot station to keep both boots planted.
   {r:Math.min(...trapezeFeet)+.89,y:p.deckY-.11,lean:83*D}
  ]:cruiser?[
   {r:.10,y:p.cockpit.floorY+.34,lean:.02,foot:.12},
   {r:p.cockpit.halfWidth-.16,y:p.deckY+.025,lean:.14,foot:.49},
   // Sit inside the lifelines with boots on the same side deck.
   {r:edge-.17,y:p.deckY+.19,lean:.26,foot:Math.min(halfBeamAt(p,x+.27),halfBeamAt(p,x-.27))-.49}
  ]:[{r:.03,y:p.deckY+.075,lean:.03},{r:p.cockpit.halfWidth-.065,y:p.deckY+.015,lean:.17},{r:edge-p.crewHikingInset,y:p.deckY+.105,lean:p.crewHikingLean}];
  // Quintic interpolation gives zero first/second pose derivatives at each
  // named stance. Passing position2 therefore cannot kick the physical CG
  // merely because its seat/torso interpolation changes segment.
  const A=seat[lo],B=seat[lo+1],r=mix(mix(A.r,B.r,t),edge+.08,k*.55),y=mix(mix(A.y,B.y,t),p.deckY+.18,k),lean=mix(mix(A.lean,B.lean,t),.28,k)*sg;
  const torso=.49,laserMotion=p.id==='laser'&&motion;
  const smooth=a=>{const q=clamp(a,0,1);return q*q*(3-2*q);};
  let duck=0;
  if(laserMotion&&!motion.capsized&&!motion.recovering){
   const headAtRest=point(x,y+Math.cos(lean)*.715,r*sg+Math.sin(lean)*.715);
   const nextAngle=motion.boom+(motion.boomRate||0)*.09;
   const near=Math.min(boomDistance(p,motion.boom,headAtRest,true),boomDistance(p,nextAngle,headAtRest,true));
   const clearance=(1-smooth((near-.13)/.22))*smooth((headAtRest.y-p.boomY+.25)/.16);
   duck=Math.max(motion.crewDuck||0,clearance);
  }
  const fold=.64*duck,hipY=y-.135*duck,vertical=Math.cos(lean)*Math.cos(fold),lateral=Math.sin(lean)*Math.cos(fold);
  const pelvis=point(x,hipY,r*sg);
  const chest=point(x+Math.sin(fold)*torso,hipY+vertical*torso,r*sg+lateral*torso);
  const head=point(chest.x+Math.sin(fold)*.225,chest.y+vertical*.225,chest.z+lateral*.225);
  let footY=p.cockpit.floorY+.11;
  if(trapezeFeet)footY=mix(footY,p.deckY+.025,smooth(d-2));
  if(cruiser&&lo===1)footY=mix(footY,p.deckY+.045,smooth(1.9*t))+.085*Math.sin(Math.PI*t);
  const hips=[point(x+.18,hipY,r*sg),point(x-.18,hipY,r*sg)];
  const stepDirection=laserMotion?Math.sign(motion.crewSideVelocity||0):0;
  const transfer=(sg*stepDirection+1)*.5;
  const feet=hips.map((_,i)=>{
   const progress=clamp((transfer-(i===0?.08:.51))/.40,0,1);
   const swing=Math.sin(Math.PI*progress)**2*clamp(Math.abs(motion?.crewSideVelocity||0),0,1);
   const reach=laserMotion?.075*swing:0;
   const foot=p.kind==='keelboat'?mix(A.foot,trapezeFeet&&lo===1?trapezeFeet[i]:B.foot,t):.045;
   return point(x+(i===0?.27:-.27)+reach,footY+k*.12+reach,
    sg*(foot+k*.23)+stepDirection*.115*swing);
  });
  const stepping=laserMotion?smooth((Math.abs(motion.crewSideVelocity||0)-.1)/.8):0;
  const knees=hips.map((h,i)=>{
   const foot=feet[i];
   if(!stepping)return jointBetween(h,foot,.47,.47);
   // A planted or swinging foot can pass almost vertically beneath the hip.
   // Use a bend direction perpendicular to the leg in the fore/up plane.
   const dx=foot.x-h.x,dy=foot.y-h.y,length=Math.hypot(dx,dy)||1;
   const bend=point(-dy*Math.sign(dx)/length,Math.abs(dx)/length,0);
   return jointBetween(h,foot,.47,.47,blendPoint(point(0,1,0),bend,stepping));
  });
  const shoulders=[point(chest.x-.18,chest.y-.035,chest.z),point(chest.x+.18,chest.y-.035,chest.z)];
  const hands=[point(x-.27,chest.y-.30,chest.z-sg*.23),point(x+.27,chest.y-.29,chest.z-sg*.26)];
  if(laserMotion){
   hands[0]=blendPoint(hands[0],point(x-.32,p.deckY+.19,chest.z*.58-(motion.rudder||0)*.24),.53+.27*duck);
   const sheet=clamp(motion.sheet??.45,0,1);
   hands[1].x+=.10-.18*sheet;hands[1].y+=.06*duck+.045*sheet;hands[1].z-=sg*.045;
  }
  const elbows=shoulders.map((sh,i)=>jointBetween(sh,hands[i],.32,.31,{x:0,y:-1,z:0}));
  const segments=[{mass:27,p:midpoint(pelvis,chest)},{mass:8,p:pelvis},{mass:6,p:head}];
  for(let i=0;i<2;i++){segments.push({mass:8,p:midpoint(hips[i],knees[i])},{mass:4,p:midpoint(knees[i],feet[i])},{mass:1,p:feet[i]},{mass:2,p:midpoint(shoulders[i],elbows[i])},{mass:1.5,p:midpoint(elbows[i],hands[i])},{mass:.5,p:hands[i]});}
  let members;if(p.crewOffsets&&!single){members=p.crewOffsets.map(dx=>crewPose(p,d,sg,k,dx,true,motion));segments.splice(0,segments.length,...members.flatMap(member=>member.segments.map(v=>({mass:v.mass,p:{...v.p}}))));}
  const total=segments.reduce((n,v)=>n+v.mass,0),targetMass=p.crewOffsets&&single?p.crewMass/p.crewOffsets.length:p.crewMass,cg=point(0,0,0);for(const v of segments){cg.x+=v.p.x*v.mass/total;cg.y+=v.p.y*v.mass/total;cg.z+=v.p.z*v.mass/total;v.mass*=targetMass/total;}
  return {pelvis,chest,head,hips,knees,feet,shoulders,elbows,hands,cg,segments,lean,degree:d,side:sg,
   ...(laserMotion?{sharedMotion:true,duck,lookDown:.05+.38*duck,lookYaw:Math.PI/2+clamp((motion.rudder||0)*.8+stepDirection*duck*.25,-.55,.55)}:{}),
   ...(members?{members}:{})};
 }
 function crewPoseAt(s){
  return crewPose(s.boatId,s.crewPoseBlend??s.crewPose??1,s.crewSideBlend??s.crewSide??-1,s.crewSwim||0,0,false,s);
 }

 // AC75 players select only a small seated crew redistribution. Pose2 is the
 // neutral baseline. The eight 90kg crew+gear stations remain protected inside
 // the hull; interpolation belongs to the simulation, never to rendering.
 function foilerCrewPositions(state){
  const p=get(state),degree=clamp(state.crewPoseBlend??2,1,3),side=clamp(state.crewSideBlend??-1,-1,1),smooth5=u=>u*u*u*(u*(u*6-15)+10),first=smooth5(clamp(degree-1,0,1)),second=smooth5(clamp(degree-2,0,1));
  const foreAft=(state.crewForeAft??0)*p.crewForeAftRange;
  // Small, bounded movements within the cockpits: middle, normal windward,
  // and the furthest usable windward position. All people retain their mass.
  return p.crewStations.map(q=>{const centre=q.z===0,shift=(centre?.12:.18)*first+(centre?.08:.18)*second;return {...q,x:q.x+foreAft,z:q.z+shift*side,y:q.y-.025*second};});
 }
 function foilerSailScale(model,name,reef=0){
  return Math.sqrt(mix(1,model.heavyAir?.[name]??1,reef));
 }
 const cruiserSails=Object.freeze({
  code0:{name:'Code 0',area:'code0Area',open:55,close:48,full:70,shadow:125,shadowLoss:.70,maxWind:14,sheet:.52,drag:.48,lift:.65,hint:'Til skæring og halvvind i let vind'},
  gennaker:{name:'Gennaker',area:'gennakerArea',open:68,close:61,full:87,shadow:139,shadowLoss:.48,maxWind:17,sheet:.48,drag:.70,lift:.46,hint:'Til slør'},
  spinnaker:{name:'Spiler',area:'spinnakerArea',open:82,close:70,full:100,shadow:151,shadowLoss:.16,maxWind:19,sheet:.42,drag:1,lift:.28,hint:'Til dybt slør og læns'}
 });
 root.SailingBoats={CONFIGS,cruiserSails,LIST:Object.values(CONFIGS),get,halfBeamAt,hullBottom,insideCockpit,crewPose,crewPoseAt,boomDistance,foilerCrewPositions,foilerSailScale,jointBetween};

});
