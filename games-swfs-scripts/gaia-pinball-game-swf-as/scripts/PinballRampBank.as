package
{
   import com.gaiaonline.games.gPinball.compound_elements.RampBank;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol1163")]
   public dynamic class PinballRampBank extends RampBank
   {
      
      public function PinballRampBank()
      {
         super();
         addFrameScript(0,frame1);
         __setProp_bank_to_kickback_trigger_mcPinballMachineRampBank_RampTriggers_1();
         __setProp_bank_closed_trigger_mcPinballMachineRampBank_RampTriggers_1();
         __setProp_enter_ramp_mcPinballMachineRampBank_RampTriggers_1();
         __setProp_bankSaucer_mcPinballMachineRampBank_BankSaucer_1();
      }
      
      internal function __setProp_bank_closed_trigger_mcPinballMachineRampBank_RampTriggers_1() : *
      {
         try
         {
            bank_closed_trigger["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         bank_closed_trigger.__Active = true;
         bank_closed_trigger.__EffectTrigger = true;
         bank_closed_trigger.__Location = "bankramp";
         bank_closed_trigger.__FuncArgs = ["bankramp","close"];
         bank_closed_trigger.__TriggerString = "controlRampGate";
         bank_closed_trigger.__SndEffect = "bankclose";
         bank_closed_trigger.__CoreFunc = true;
         try
         {
            bank_closed_trigger["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function frame1() : *
      {
         stop();
      }
      
      internal function __setProp_bankSaucer_mcPinballMachineRampBank_BankSaucer_1() : *
      {
         try
         {
            bankSaucer["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         bankSaucer.__Active = true;
         bankSaucer.__EjectLocation = "this";
         bankSaucer.__EjectSpeedMax = 1;
         bankSaucer.__EjectSpeedMin = 10;
         bankSaucer.__FunctionString = "enterBankSaucer";
         bankSaucer.__Location = "bankramp";
         bankSaucer.__FuncArgs = ["null"];
         bankSaucer.__SndEffectEject = "none";
         bankSaucer.__SndEffectLock = "none";
         bankSaucer.__SaucerVis = false;
         bankSaucer.__SaucerType = "lock";
         bankSaucer.__CoreFunc = true;
         try
         {
            bankSaucer["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_bank_to_kickback_trigger_mcPinballMachineRampBank_RampTriggers_1() : *
      {
         try
         {
            bank_to_kickback_trigger["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         bank_to_kickback_trigger.__Active = true;
         bank_to_kickback_trigger.__EffectTrigger = true;
         bank_to_kickback_trigger.__Location = "bankramp";
         bank_to_kickback_trigger.__TriggerString = "enterRampBKB";
         bank_to_kickback_trigger.__SndEffect = "none";
         bank_to_kickback_trigger.__CoreFunc = true;
         try
         {
            bank_to_kickback_trigger["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_enter_ramp_mcPinballMachineRampBank_RampTriggers_1() : *
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
         enter_ramp.__TriggerString = "enterRampBank";
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

