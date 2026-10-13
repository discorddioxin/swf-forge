package
{
   import com.gaiaonline.games.gPinball.compound_elements.Saucer;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol990")]
   public dynamic class PinballSaucer extends Saucer
   {
      
      public function PinballSaucer()
      {
         super();
         addFrameScript(0,frame1);
         __setProp___SaucerTrigger_mcPinballMachineSaucer_Layer2_1();
      }
      
      internal function frame1() : *
      {
         init();
      }
      
      internal function __setProp___SaucerTrigger_mcPinballMachineSaucer_Layer2_1() : *
      {
         try
         {
            __SaucerTrigger["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         __SaucerTrigger.__Active = true;
         __SaucerTrigger.__EffectTrigger = false;
         __SaucerTrigger.__Location = "useParent";
         __SaucerTrigger.__FuncArgs = ["null"];
         __SaucerTrigger.__TriggerString = "enterSaucer";
         __SaucerTrigger.__SndEffect = "none";
         __SaucerTrigger.__CoreFunc = false;
         try
         {
            __SaucerTrigger["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
   }
}

