package
{
   import com.gaiaonline.games.gPinball.compound_elements.TargetGroup;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol1235")]
   public dynamic class bot2Group extends TargetGroup
   {
      
      public function bot2Group()
      {
         super();
         addFrameScript(0,frame1,2,frame3);
         __setProp_target0_bot2Group_Layer3_1();
      }
      
      internal function __setProp_target0_bot2Group_Layer3_1() : *
      {
         try
         {
            target0["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         target0.__Active = true;
         target0.__GroupQueue = "__HitQueue";
         target0.__DropLevel = 1;
         target0.__LightLevel = 1;
         target0.__Location = "useParent";
         target0.__ScoreLink = "bot2";
         target0.__SndEffectLevel = false;
         target0.__SndEffectHit = "grunny2";
         target0.__SndEffectUnhit = "none";
         target0.__TargetType = "spot";
         try
         {
            target0["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function frame3() : *
      {
         gotoAndPlay(2);
      }
      
      internal function frame1() : *
      {
         popAll();
         stop();
      }
   }
}

