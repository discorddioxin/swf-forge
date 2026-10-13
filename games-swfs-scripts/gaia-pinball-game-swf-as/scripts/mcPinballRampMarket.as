package
{
   import com.gaiaonline.games.gPinball.compound_elements.RampMarket;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol1160")]
   public dynamic class mcPinballRampMarket extends RampMarket
   {
      
      public function mcPinballRampMarket()
      {
         super();
         addFrameScript(0,frame1);
         __setProp_market_closed_trigger_mcPinballMachineRampMarket_RampTriggers_1();
         __setProp_marketSaucer_mcPinballMachineRampMarket_SaucerLock_1();
         __setProp_market_to_kickback_trigger_mcPinballMachineRampMarket_RampTriggers_1();
         __setProp_enter_ramp_mcPinballMachineRampMarket_RampTriggers_1();
      }
      
      internal function __setProp_market_to_kickback_trigger_mcPinballMachineRampMarket_RampTriggers_1() : *
      {
         try
         {
            market_to_kickback_trigger["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         market_to_kickback_trigger.__Active = true;
         market_to_kickback_trigger.__EffectTrigger = true;
         market_to_kickback_trigger.__Location = "marketramp";
         market_to_kickback_trigger.__TriggerString = "enterRampMKB";
         market_to_kickback_trigger.__SndEffect = "none";
         market_to_kickback_trigger.__CoreFunc = true;
         try
         {
            market_to_kickback_trigger["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function frame1() : *
      {
         stop();
      }
      
      internal function __setProp_marketSaucer_mcPinballMachineRampMarket_SaucerLock_1() : *
      {
         try
         {
            marketSaucer["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         marketSaucer.__Active = true;
         marketSaucer.__EjectLocation = "this";
         marketSaucer.__EjectSpeedMax = 1;
         marketSaucer.__EjectSpeedMin = 10;
         marketSaucer.__FunctionString = "enterMarketSaucer";
         marketSaucer.__Location = "marketramp";
         marketSaucer.__FuncArgs = ["null"];
         marketSaucer.__SndEffectEject = "none";
         marketSaucer.__SndEffectLock = "none";
         marketSaucer.__SaucerVis = true;
         marketSaucer.__SaucerType = "lock";
         marketSaucer.__CoreFunc = true;
         try
         {
            marketSaucer["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_enter_ramp_mcPinballMachineRampMarket_RampTriggers_1() : *
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
         enter_ramp.__TriggerString = "enterRampMarket";
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
      
      internal function __setProp_market_closed_trigger_mcPinballMachineRampMarket_RampTriggers_1() : *
      {
         try
         {
            market_closed_trigger["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         market_closed_trigger.__Active = true;
         market_closed_trigger.__EffectTrigger = true;
         market_closed_trigger.__Location = "marketramp";
         market_closed_trigger.__FuncArgs = ["marketramp","close"];
         market_closed_trigger.__TriggerString = "controlRampGate";
         market_closed_trigger.__SndEffect = "none";
         market_closed_trigger.__CoreFunc = true;
         try
         {
            market_closed_trigger["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
   }
}

