package
{
   import com.gaiaonline.games.gPinball.compound_elements.TargetGroup;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol1215")]
   public dynamic class CowGroup extends TargetGroup
   {
      
      public function CowGroup()
      {
         super();
         addFrameScript(0,frame1);
         __setProp_target0_mcCowGroup_Layer4_1();
      }
      
      internal function frame1() : *
      {
         popAll();
         stop();
      }
      
      internal function __setProp_target0_mcCowGroup_Layer4_1() : *
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
         target0.__ScoreLink = "genericTarget";
         target0.__SndEffectLevel = false;
         target0.__SndEffectHit = "none";
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
   }
}

