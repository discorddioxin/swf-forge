package
{
   import com.gaiaonline.games.gPinball.compound_elements.RampHelson;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol1586")]
   public dynamic class PinballHelsonRamp extends RampHelson
   {
      
      public function PinballHelsonRamp()
      {
         super();
         addFrameScript(0,frame1,29,frame30,59,frame60);
         __setProp_drainTrigger5_mcPinballMachineHelsonRamp_DrainTrigger_1();
         __setProp_hFlipper_rr_mcPinballMachineHelsonRamp_HelsonFlippers_1();
         __setProp_drainTrigger_mcPinballMachineHelsonRamp_DrainTrigger_1();
         __setProp_helsonTargets_mcPinballMachineHelsonRamp_HelsonTargets_1();
         __setProp_helsonBumper3_mcPinballMachineHelsonRamp_HelsonBumpers_1();
         __setProp_hFlipper_rc_mcPinballMachineHelsonRamp_HelsonFlippers_1();
         __setProp_hFlipper_ll_mcPinballMachineHelsonRamp_HelsonFlippers_1();
         __setProp_launchSaucer_mcPinballMachineHelsonRamp_launchSaucer_1();
         __setProp_helsonBumper1_mcPinballMachineHelsonRamp_HelsonBumpers_1();
         __setProp_hFlipper_lc_mcPinballMachineHelsonRamp_HelsonFlippers_1();
         __setProp_drainTrigger2_mcPinballMachineHelsonRamp_DrainTrigger_1();
         __setProp_helsonBumper0_mcPinballMachineHelsonRamp_HelsonBumpers_1();
         __setProp_drainTrigger1_mcPinballMachineHelsonRamp_DrainTrigger_1();
         __setProp_helsonBumper2_mcPinballMachineHelsonRamp_HelsonBumpers_1();
         __setProp_helsonBumper4_mcPinballMachineHelsonRamp_HelsonBumpers_1();
         __setProp_drainTrigger3_mcPinballMachineHelsonRamp_DrainTrigger_1();
         __setProp_drainTrigger4_mcPinballMachineHelsonRamp_DrainTrigger_1();
      }
      
      internal function __setProp_hFlipper_lc_mcPinballMachineHelsonRamp_HelsonFlippers_1() : *
      {
         try
         {
            hFlipper_lc["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         hFlipper_lc.power = 30;
         hFlipper_lc.__Location = "helsonramp";
         hFlipper_lc.__SndEffectFlip = "none";
         hFlipper_lc.__SndEffectUnflip = "none";
         try
         {
            hFlipper_lc["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function frame1() : *
      {
         stop();
      }
      
      internal function __setProp_drainTrigger3_mcPinballMachineHelsonRamp_DrainTrigger_1() : *
      {
         try
         {
            drainTrigger3["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         drainTrigger3.__Active = true;
         drainTrigger3.__EffectTrigger = false;
         drainTrigger3.__Location = "helsonramp";
         drainTrigger3.__FuncArgs = ["fail"];
         drainTrigger3.__TriggerString = "exitRampHelson";
         drainTrigger3.__SndEffect = "none";
         drainTrigger3.__CoreFunc = true;
         try
         {
            drainTrigger3["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function frame30() : *
      {
         stop();
         makeReady();
      }
      
      internal function __setProp_helsonBumper1_mcPinballMachineHelsonRamp_HelsonBumpers_1() : *
      {
         try
         {
            helsonBumper1["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         helsonBumper1.__ArtLevel = 2;
         helsonBumper1.__Power = 8;
         helsonBumper1.__Location = "helsonramp";
         helsonBumper1.__ScoreLink = "helsonBumper";
         helsonBumper1.__SndEffectLevel = false;
         helsonBumper1.__SndEffectHit = "arenabumper25";
         try
         {
            helsonBumper1["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_helsonBumper4_mcPinballMachineHelsonRamp_HelsonBumpers_1() : *
      {
         try
         {
            helsonBumper4["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         helsonBumper4.__ArtLevel = 4;
         helsonBumper4.__Power = 5;
         helsonBumper4.__Location = "helsonramp";
         helsonBumper4.__ScoreLink = "helsonBumper";
         helsonBumper4.__SndEffectLevel = false;
         helsonBumper4.__SndEffectHit = "KickerElastic";
         try
         {
            helsonBumper4["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_hFlipper_ll_mcPinballMachineHelsonRamp_HelsonFlippers_1() : *
      {
         try
         {
            hFlipper_ll["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         hFlipper_ll.power = 30;
         hFlipper_ll.__Location = "helsonramp";
         hFlipper_ll.__SndEffectFlip = "none";
         hFlipper_ll.__SndEffectUnflip = "none";
         try
         {
            hFlipper_ll["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_launchSaucer_mcPinballMachineHelsonRamp_launchSaucer_1() : *
      {
         try
         {
            launchSaucer["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         launchSaucer.__Active = true;
         launchSaucer.__EjectLocation = "this";
         launchSaucer.__EjectSpeedMax = 1;
         launchSaucer.__EjectSpeedMin = 1;
         launchSaucer.__FunctionString = "enterHelsonLaunch";
         launchSaucer.__Location = "helsonramp";
         launchSaucer.__FuncArgs = ["null"];
         launchSaucer.__SndEffectEject = "none";
         launchSaucer.__SndEffectLock = "none";
         launchSaucer.__SaucerVis = true;
         launchSaucer.__SaucerType = "lock";
         launchSaucer.__CoreFunc = true;
         try
         {
            launchSaucer["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function frame60() : *
      {
         makeUnready();
         gotoAndStop(1);
      }
      
      internal function __setProp_drainTrigger_mcPinballMachineHelsonRamp_DrainTrigger_1() : *
      {
         try
         {
            drainTrigger["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         drainTrigger.__Active = true;
         drainTrigger.__EffectTrigger = false;
         drainTrigger.__Location = "helsonramp";
         drainTrigger.__FuncArgs = ["fail"];
         drainTrigger.__TriggerString = "exitRampHelson";
         drainTrigger.__SndEffect = "none";
         drainTrigger.__CoreFunc = true;
         try
         {
            drainTrigger["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_drainTrigger1_mcPinballMachineHelsonRamp_DrainTrigger_1() : *
      {
         try
         {
            drainTrigger1["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         drainTrigger1.__Active = true;
         drainTrigger1.__EffectTrigger = false;
         drainTrigger1.__Location = "helsonramp";
         drainTrigger1.__FuncArgs = ["fail"];
         drainTrigger1.__TriggerString = "exitRampHelson";
         drainTrigger1.__SndEffect = "none";
         drainTrigger1.__CoreFunc = true;
         try
         {
            drainTrigger1["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_drainTrigger4_mcPinballMachineHelsonRamp_DrainTrigger_1() : *
      {
         try
         {
            drainTrigger4["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         drainTrigger4.__Active = true;
         drainTrigger4.__EffectTrigger = false;
         drainTrigger4.__Location = "helsonramp";
         drainTrigger4.__FuncArgs = ["fail"];
         drainTrigger4.__TriggerString = "exitRampHelson";
         drainTrigger4.__SndEffect = "none";
         drainTrigger4.__CoreFunc = true;
         try
         {
            drainTrigger4["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_helsonBumper0_mcPinballMachineHelsonRamp_HelsonBumpers_1() : *
      {
         try
         {
            helsonBumper0["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         helsonBumper0.__ArtLevel = 3;
         helsonBumper0.__Power = 8;
         helsonBumper0.__Location = "helsonramp";
         helsonBumper0.__ScoreLink = "helsonBumper";
         helsonBumper0.__SndEffectLevel = false;
         helsonBumper0.__SndEffectHit = "arenabumper15";
         try
         {
            helsonBumper0["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_hFlipper_rr_mcPinballMachineHelsonRamp_HelsonFlippers_1() : *
      {
         try
         {
            hFlipper_rr["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         hFlipper_rr.power = 30;
         hFlipper_rr.__Location = "helsonramp";
         hFlipper_rr.__SndEffectFlip = "none";
         hFlipper_rr.__SndEffectUnflip = "none";
         try
         {
            hFlipper_rr["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_helsonTargets_mcPinballMachineHelsonRamp_HelsonTargets_1() : *
      {
         try
         {
            helsonTargets["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         helsonTargets.__AutoPop = false;
         helsonTargets.__CompFuncStr = "helsonComplete";
         helsonTargets.__Location = "helsonramp";
         helsonTargets.__MaxDrops = 1;
         helsonTargets.__MaxLevel = 1;
         helsonTargets.__PopAudio = "none";
         helsonTargets.__PopupTime = 250;
         helsonTargets.__GroupScoreLink = "helsonTarget";
         helsonTargets.__GroupQueue = "__HitQueue";
         helsonTargets.__GroupTargetType = "spot";
         try
         {
            helsonTargets["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_helsonBumper3_mcPinballMachineHelsonRamp_HelsonBumpers_1() : *
      {
         try
         {
            helsonBumper3["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         helsonBumper3.__ArtLevel = 4;
         helsonBumper3.__Power = 5;
         helsonBumper3.__Location = "helsonramp";
         helsonBumper3.__ScoreLink = "helsonBumper";
         helsonBumper3.__SndEffectLevel = false;
         helsonBumper3.__SndEffectHit = "KickerElastic";
         try
         {
            helsonBumper3["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_drainTrigger2_mcPinballMachineHelsonRamp_DrainTrigger_1() : *
      {
         try
         {
            drainTrigger2["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         drainTrigger2.__Active = true;
         drainTrigger2.__EffectTrigger = false;
         drainTrigger2.__Location = "helsonramp";
         drainTrigger2.__FuncArgs = ["fail"];
         drainTrigger2.__TriggerString = "exitRampHelson";
         drainTrigger2.__SndEffect = "none";
         drainTrigger2.__CoreFunc = true;
         try
         {
            drainTrigger2["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_drainTrigger5_mcPinballMachineHelsonRamp_DrainTrigger_1() : *
      {
         try
         {
            drainTrigger5["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         drainTrigger5.__Active = true;
         drainTrigger5.__EffectTrigger = false;
         drainTrigger5.__Location = "helsonramp";
         drainTrigger5.__FuncArgs = ["fail"];
         drainTrigger5.__TriggerString = "exitRampHelson";
         drainTrigger5.__SndEffect = "none";
         drainTrigger5.__CoreFunc = true;
         try
         {
            drainTrigger5["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_helsonBumper2_mcPinballMachineHelsonRamp_HelsonBumpers_1() : *
      {
         try
         {
            helsonBumper2["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         helsonBumper2.__ArtLevel = 1;
         helsonBumper2.__Power = 8;
         helsonBumper2.__Location = "helsonramp";
         helsonBumper2.__ScoreLink = "helsonBumper";
         helsonBumper2.__SndEffectLevel = false;
         helsonBumper2.__SndEffectHit = "arenabumper05";
         try
         {
            helsonBumper2["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_hFlipper_rc_mcPinballMachineHelsonRamp_HelsonFlippers_1() : *
      {
         try
         {
            hFlipper_rc["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         hFlipper_rc.power = 30;
         hFlipper_rc.__Location = "helsonramp";
         hFlipper_rc.__SndEffectFlip = "none";
         hFlipper_rc.__SndEffectUnflip = "none";
         try
         {
            hFlipper_rc["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
   }
}

