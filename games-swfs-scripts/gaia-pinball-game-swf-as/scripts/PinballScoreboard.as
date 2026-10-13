package
{
   import com.gaiaonline.games.gPinball.PinballScoreBoard;
   
   [Embed(source="/_assets/assets.swf", symbol="symbol954")]
   public dynamic class PinballScoreboard extends PinballScoreBoard
   {
      
      public function PinballScoreboard()
      {
         super();
         addFrameScript(0,frame1);
         __setProp_IGMD_MASTER_mcPinballMachineScoreboard_IGMDTransition_1();
      }
      
      internal function __setProp_IGMD_MASTER_mcPinballMachineScoreboard_IGMDTransition_1() : *
      {
         try
         {
            IGMD_MASTER["componentInspectorSetting"] = true;
         }
         catch(e:Error)
         {
         }
         IGMD_MASTER.animating = false;
         IGMD_MASTER.enabled = true;
         IGMD_MASTER.image = "";
         IGMD_MASTER.introDuration = 1000;
         IGMD_MASTER.introIterator = "TopDownIterator";
         IGMD_MASTER.introTransition = "WipeTransitionLeftIn";
         IGMD_MASTER.outroDuration = 1000;
         IGMD_MASTER.outroIterator = "BottomUpIterator";
         IGMD_MASTER.outroTransition = "WipeTransitionRightOut";
         IGMD_MASTER.pauseDuration = 1000;
         IGMD_MASTER.pixelSeparation = 1;
         IGMD_MASTER.pixelSize = 3;
         IGMD_MASTER.sceneStartOffset = 0;
         IGMD_MASTER.visible = true;
         try
         {
            IGMD_MASTER["componentInspectorSetting"] = false;
         }
         catch(e:Error)
         {
         }
      }
      
      internal function frame1() : *
      {
      }
   }
}

