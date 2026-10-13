package
{
   import com.gaiaonline.games.gPinball.compound_elements.RampMarketKickBack;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol1000")]
   public dynamic class PinballMarketKickBack extends RampMarketKickBack
   {
      
      public function PinballMarketKickBack()
      {
         super();
         addFrameScript(0,frame1);
         __setProp_market_kb_closed_trigger_mcPinballMachineRampMarketKickBack_RampTriggers_1();
         __setProp_MKBSaucer_mcPinballMachineRampMarketKickBack_SaucerLock_1();
         __setProp_enter_ramp_mcPinballMachineRampMarketKickBack_RampTriggers_1();
      }
      
      internal function __setProp_market_kb_closed_trigger_mcPinballMachineRampMarketKickBack_RampTriggers_1() : *
      {
         try
         {
            market_kb_closed_trigger["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         market_kb_closed_trigger.__Active = true;
         market_kb_closed_trigger.__EffectTrigger = false;
         market_kb_closed_trigger.__Location = "mkbramp";
         market_kb_closed_trigger.__TriggerString = "exitRampMKB";
         market_kb_closed_trigger.__SndEffect = "none";
         market_kb_closed_trigger.__CoreFunc = true;
         try
         {
            market_kb_closed_trigger["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function frame1() : *
      {
         stop();
         init();
      }
      
      internal function __setProp_enter_ramp_mcPinballMachineRampMarketKickBack_RampTriggers_1() : *
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
         enter_ramp.__TriggerString = "enterRampMKB";
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
      
      internal function __setProp_MKBSaucer_mcPinballMachineRampMarketKickBack_SaucerLock_1() : *
      {
         try
         {
            MKBSaucer["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         MKBSaucer.__Active = true;
         MKBSaucer.__EjectLocation = "this";
         MKBSaucer.__EjectSpeedMax = 30;
         MKBSaucer.__EjectSpeedMin = 25;
         MKBSaucer.__FunctionString = "enterMKBSaucer";
         MKBSaucer.__Location = "mkbramp";
         MKBSaucer.__FuncArgs = ["null"];
         MKBSaucer.__SndEffectEject = "kickback";
         MKBSaucer.__SndEffectLock = "none";
         MKBSaucer.__SaucerVis = true;
         MKBSaucer.__SaucerType = "lock";
         MKBSaucer.__CoreFunc = true;
         try
         {
            MKBSaucer["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
   }
}

