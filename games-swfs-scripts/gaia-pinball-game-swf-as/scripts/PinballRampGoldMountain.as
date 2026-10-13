package
{
   import adobe.utils.*;
   import com.gaiaonline.games.gPinball.compound_elements.RampGoldMountain;
   import flash.accessibility.*;
   import flash.display.*;
   import flash.errors.*;
   import flash.events.*;
   import flash.external.*;
   import flash.filters.*;
   import flash.geom.*;
   import flash.media.*;
   import flash.net.*;
   import flash.printing.*;
   import flash.system.*;
   import flash.text.*;
   import flash.ui.*;
   import flash.utils.*;
   import flash.xml.*;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol1289")]
   public dynamic class PinballRampGoldMountain extends RampGoldMountain
   {
      
      public var __id18_:PinballTrigger;
      
      public function PinballRampGoldMountain()
      {
         super();
         addFrameScript(0,frame1);
         __setProp_enter_ramp_mcPinballMachineRampGoldMountain_RampTriggers_1();
         __setProp_gm_trigger_mcPinballMachineRampGoldMountain_RampTriggers_1();
         __setProp_exit_ramp_mcPinballMachineRampGoldMountain_RampTriggers_1();
         __setProp___id18__mcPinballMachineRampGoldMountain_RampTriggers_1();
         __setProp_enter_out_mcPinballMachineRampGoldMountain_RampTriggers_1();
         __setProp_tokenSpinner_mcPinballMachineRampGoldMountain_TokenSpinner_1();
      }
      
      internal function __setProp_gm_trigger_mcPinballMachineRampGoldMountain_RampTriggers_1() : *
      {
         try
         {
            gm_trigger["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         gm_trigger.__Active = true;
         gm_trigger.__EffectTrigger = true;
         gm_trigger.__Location = "gmramp";
         gm_trigger.__FuncArgs = ["gmramp","close"];
         gm_trigger.__TriggerString = "controlRampGate";
         gm_trigger.__SndEffect = "casinoclose";
         gm_trigger.__CoreFunc = true;
         try
         {
            gm_trigger["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_exit_ramp_mcPinballMachineRampGoldMountain_RampTriggers_1() : *
      {
         try
         {
            exit_ramp["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         exit_ramp.__Active = true;
         exit_ramp.__EffectTrigger = false;
         exit_ramp.__Location = "gmramp";
         exit_ramp.__TriggerString = "endRampGoldMountain";
         exit_ramp.__SndEffect = "none";
         exit_ramp.__CoreFunc = true;
         try
         {
            exit_ramp["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_enter_out_mcPinballMachineRampGoldMountain_RampTriggers_1() : *
      {
         try
         {
            enter_out["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         enter_out.__Active = true;
         enter_out.__EffectTrigger = false;
         enter_out.__Location = "gmramp";
         enter_out.__TriggerString = "exitRampGoldMountain";
         enter_out.__SndEffect = "none";
         enter_out.__CoreFunc = true;
         try
         {
            enter_out["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_tokenSpinner_mcPinballMachineRampGoldMountain_TokenSpinner_1() : *
      {
         try
         {
            tokenSpinner["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         tokenSpinner.__Deceleration = 0.2;
         tokenSpinner.__SpinEnergy = 5;
         tokenSpinner.__SndEffectEvent = "none";
         tokenSpinner.__Location = "gmramp";
         tokenSpinner.__MaxLevel = 0;
         tokenSpinner.__SndEffect = "tokenspinner";
         tokenSpinner.__SpinFrames = 6;
         try
         {
            tokenSpinner["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function frame1() : *
      {
         stop();
      }
      
      internal function __setProp___id18__mcPinballMachineRampGoldMountain_RampTriggers_1() : *
      {
         try
         {
            __id18_["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         __id18_.__Active = true;
         __id18_.__EffectTrigger = false;
         __id18_.__Location = "gmramp";
         __id18_.__FuncArgs = ["null"];
         __id18_.__TriggerString = "takeShortcut";
         __id18_.__SndEffect = "none";
         __id18_.__CoreFunc = true;
         try
         {
            __id18_["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_enter_ramp_mcPinballMachineRampGoldMountain_RampTriggers_1() : *
      {
         try
         {
            enter_ramp["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         enter_ramp.__Active = false;
         enter_ramp.__EffectTrigger = false;
         enter_ramp.__Location = "table";
         enter_ramp.__TriggerString = "enterRampGoldMountain";
         enter_ramp.__SndEffect = "none";
         enter_ramp.__CoreFunc = true;
         try
         {
            enter_ramp["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
   }
}

