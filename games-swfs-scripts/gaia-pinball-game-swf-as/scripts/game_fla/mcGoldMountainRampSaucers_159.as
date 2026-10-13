package game_fla
{
   import flash.display.MovieClip;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol1274")]
   public dynamic class mcGoldMountainRampSaucers_159 extends MovieClip
   {
      
      public var gmSaucerEject:PinballSaucer;
      
      public var gmSaucer:PinballSaucer;
      
      public function mcGoldMountainRampSaucers_159()
      {
         super();
         __setProp_gmSaucer_mcGoldMountainRampSaucers_SaucerLock_1();
         __setProp_gmSaucerEject_mcGoldMountainRampSaucers_SaucerLock_1();
      }
      
      internal function __setProp_gmSaucerEject_mcGoldMountainRampSaucers_SaucerLock_1() : *
      {
         try
         {
            gmSaucerEject["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         gmSaucerEject.__Active = true;
         gmSaucerEject.__EjectLocation = "gmSaucerEject";
         gmSaucerEject.__EjectSpeedMax = 1;
         gmSaucerEject.__EjectSpeedMin = 10;
         gmSaucerEject.__FunctionString = "defaultFunction";
         gmSaucerEject.__Location = "gmramp";
         gmSaucerEject.__FuncArgs = ["null"];
         gmSaucerEject.__SndEffectEject = "none";
         gmSaucerEject.__SndEffectLock = "none";
         gmSaucerEject.__SaucerVis = true;
         gmSaucerEject.__SaucerType = "hole";
         gmSaucerEject.__CoreFunc = true;
         try
         {
            gmSaucerEject["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function __setProp_gmSaucer_mcGoldMountainRampSaucers_SaucerLock_1() : *
      {
         try
         {
            gmSaucer["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         gmSaucer.__Active = true;
         gmSaucer.__EjectLocation = "gmSaucerEject";
         gmSaucer.__EjectSpeedMax = 1;
         gmSaucer.__EjectSpeedMin = 15;
         gmSaucer.__FunctionString = "enterGoldMountainSaucer";
         gmSaucer.__Location = "gmramp";
         gmSaucer.__FuncArgs = ["null"];
         gmSaucer.__SndEffectEject = "none";
         gmSaucer.__SndEffectLock = "none";
         gmSaucer.__SaucerVis = true;
         gmSaucer.__SaucerType = "hole";
         gmSaucer.__CoreFunc = true;
         try
         {
            gmSaucer["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
   }
}

